import { Agent, callable, type StreamingResponse } from "agents";
import { fetchProductsByIds } from "./catalog-tool";
import {
  ConversationStore,
  INITIAL_DISCOVERY_AGENT_STATE,
  type DiscoveryAgentState,
} from "./state";
import {
  applyDegradedNudge,
  generateValidatedTurn,
  renderTurnPrompt,
  summarizeRound,
} from "./turn-generation";

/**
 * Discovery-chat Agent. See
 * sales-agent/.scratch/discovery-agent-architecture/build-plan.md.
 *
 * Phases 1-3 built the plumbing (routing, state, catalog tool). Phase 4
 * wires it into the actual conversation loop, ported from
 * sales-agent's _run_round/_present_and_confirm/_summarize_round
 * (main.py:252-423).
 *
 * Key structural translation, since submitTurn is called once per shopper
 * message (RPC) rather than Python's free-running `while True` loop: each
 * call does "finish the previous step, then do the next one" —
 * append the shopper's reply and advance turnInRound (skipped only for
 * the very first-ever call, where the reply is the opening request, not
 * an answer to a question — matching Python's initial_request being
 * captured separately, before the round loop starts), then render the
 * next prompt, generate, and apply the result.
 */

export interface Env {
  [key: string]: unknown;
}

/** What submitTurn/respondToRecommendation return via stream.end() — kept
 * as a discriminated union so the frontend (Phase 6) can render either
 * case (a question to answer, or a recommendation with real product data
 * to show via ProductTile — see ticket 10's resolution and state.ts's
 * note on finalRecommendationLabels for why this isn't Python's
 * text-blob recommendation). */
export type TurnResult =
  | { kind: "question"; message: string; degraded: boolean }
  | {
      kind: "recommendation";
      message: string;
      forced: boolean;
      degraded: boolean;
      products: Awaited<ReturnType<typeof fetchProductsByIds>>;
    };

export class DiscoveryAgent extends Agent<Env, DiscoveryAgentState> {
  initialState: DiscoveryAgentState = INITIAL_DISCOVERY_AGENT_STATE;

  private store!: ConversationStore;

  onStart(): void {
    this.store = new ConversationStore(this.sql.bind(this));
    this.store.ensureTables();
  }

  @callable()
  ping(): string {
    return "pong";
  }

  @callable({ streaming: true })
  async submitTurn(stream: StreamingResponse, reply: string): Promise<void> {
    try {
      let promptText: string;

      if (this.state.initialRequest === "") {
        // First-ever message for this Agent instance: this is the opening
        // request, not an answer to a question — captured separately,
        // same as Python's initial_request (set before the round loop
        // starts, never appended to conversation_history, turnInRound
        // stays at 0 for this first render).
        this.setState({ ...this.state, initialRequest: reply });
      } else {
        this.store.recordTurn(this.state.roundCount, "shopper", reply);
        this.setState({ ...this.state, turnInRound: this.state.turnInRound + 1 });
      }

      promptText = renderTurnPrompt({
        initialRequest: this.state.initialRequest,
        turnInRound: this.state.turnInRound,
        maxTurnsPerRound: this.state.maxTurnsPerRound,
        roundSummaries: this.store.allRoundSummaries(),
        rejectedProductLabels: this.store.rejectedLabels(),
        candidateProductLabels: this.store.candidateLabels(),
        conversationHistory: this.store.historyForRound(this.state.roundCount),
      });

      const result = await this.generateAndApplyTurn(promptText);
      stream.end(result);
    } catch (err) {
      stream.error(err instanceof Error ? err.message : String(err));
    }
  }

  @callable({ streaming: true })
  async respondToRecommendation(stream: StreamingResponse, accepted: boolean): Promise<void> {
    try {
      const recommendedLabels = this.state.pendingRecommendationLabels;

      if (accepted) {
        this.setState({
          ...this.state,
          isComplete: true,
          finalRecommendationLabels: recommendedLabels,
          pendingRecommendationLabels: [],
        });
        stream.end({ kind: "accepted" });
        return;
      }

      // Rejected: roll over to a new round — ported from
      // _present_and_confirm's rejection branch (main.py:359-364).
      // conversation_history is NOT cleared (ticket 06's resolution —
      // kept per-round for reconstruction, the new round just has no
      // rows yet under the new round number).
      this.store.addRejectedLabels(recommendedLabels);
      const transcript = this.store
        .historyForRound(this.state.roundCount)
        .map((t) => `${t.speaker}: ${t.content}`)
        .join("\n");
      const summary = await summarizeRound(transcript, this.state.candidateCap);
      this.store.addRoundSummary(this.state.roundCount, summary);
      this.store.clearCandidatesForNewRound();

      this.setState({
        ...this.state,
        roundCount: this.state.roundCount + 1,
        turnInRound: 0,
        pendingRecommendationLabels: [],
      });

      // Matching Python: after rollover, the outer loop immediately
      // starts the new round's first turn rather than waiting for
      // another shopper message (main.py's run_conversation while-loop
      // calling _run_round() again right away).
      const promptText = renderTurnPrompt({
        initialRequest: this.state.initialRequest,
        turnInRound: this.state.turnInRound,
        maxTurnsPerRound: this.state.maxTurnsPerRound,
        roundSummaries: this.store.allRoundSummaries(),
        rejectedProductLabels: this.store.rejectedLabels(),
        candidateProductLabels: this.store.candidateLabels(),
        conversationHistory: this.store.historyForRound(this.state.roundCount),
      });
      const result = await this.generateAndApplyTurn(promptText);
      stream.end(result);
    } catch (err) {
      stream.error(err instanceof Error ? err.message : String(err));
    }
  }

  /** Shared by submitTurn and respondToRecommendation's rollover path —
   * both need "generate one validated turn, apply it, decide if it's a
   * question or the round's final recommendation." Ported from the tail
   * of _run_round (main.py:252-275). */
  private async generateAndApplyTurn(promptText: string): Promise<TurnResult> {
    const previousCandidateLabels = this.store.candidateLabels();

    const { turn, degraded } = await generateValidatedTurn({
      promptText,
      store: this.store,
      candidateCap: this.state.candidateCap,
      previousCandidateLabels,
      rejectedProductLabels: this.store.rejectedLabels(),
    });

    // Ticket 07's repeated-failure escalation: track consecutive degraded
    // turns (any normal turn resets it), and nudge toward the kept
    // filter-UI fallback once the streak hits the threshold. Applied to
    // `message` before it's recorded/returned, in both branches below —
    // a degraded turn can land in either (confirmed live: a hard-stop on
    // an already-degraded turn produces exactly this case).
    const consecutiveDegradedTurns = degraded ? this.state.consecutiveDegradedTurns + 1 : 0;
    this.setState({ ...this.state, consecutiveDegradedTurns });
    const message = degraded
      ? applyDegradedNudge(turn.message, consecutiveDegradedTurns)
      : turn.message;

    this.store.recordTurn(this.state.roundCount, "advisor", message);
    this.store.setCandidateLabels(turn.updated_candidate_labels);

    const hitHardStop = this.state.turnInRound + 1 >= this.state.maxTurnsPerRound;

    if (turn.is_final || hitHardStop) {
      // Same three-way fallback as Python (main.py:268-272): a forced
      // turn can still come back with an empty shortlist, so fall back
      // through the current (post-update) candidates, then the
      // pre-update ones, rather than ever presenting nothing.
      const currentCandidates = this.store.candidateLabels();
      const recommendedLabels =
        turn.recommended_product_labels.length > 0
          ? turn.recommended_product_labels
          : currentCandidates.length > 0
            ? currentCandidates.slice(0, 3)
            : previousCandidateLabels.slice(0, 3);
      const forced = hitHardStop && !turn.is_final;

      this.setState({ ...this.state, pendingRecommendationLabels: recommendedLabels });

      const productIds = this.store.idsForLabels(recommendedLabels);
      const products = await fetchProductsByIds(productIds);
      return { kind: "recommendation", message, forced, degraded, products };
    }

    return { kind: "question", message, degraded };
  }
}
