import { generateText, isStepCount, NoOutputGeneratedError, Output } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
// @ts-expect-error -- ambient Cloudflare Workers module, no local types
import { env } from "cloudflare:workers";
import { createSearchCatalogTool } from "./catalog-tool";
import { validateTurn } from "./guardrails";
import { SalesTurnOutputSchema, type SalesTurnOutput } from "./schemas";
import { BRIEFING_TEXT, STORE_DESCRIPTION, STORE_NAME } from "./store-config";
import type { ConversationStore } from "./state";

/**
 * Generation + validation + retry, ported from sales-agent's
 * _kickoff_validated_turn/_render_turn_prompt/build_sales_advisor
 * (main.py:282-423, sales_advisor/agent.py). CrewAI's Agent/goal/backstory
 * become a plain `system` string; its per-turn `kickoff_async(prompt, ...)`
 * becomes `generateText` with `tools` + `output: Output.object(...)` in one
 * call (confirmed real against ai@7.0.58's actual shipped types — see
 * build-plan.md Phase 4's spike).
 */

// Matches Python's _MAX_TURN_VALIDATION_RETRIES (main.py:39) — total
// attempts = 1 + this many retries.
const MAX_VALIDATION_RETRIES = 2;

// Ticket 07: "1-2 attempts, short fixed delay" for a raw provider-call
// failure, distinct from the validation-retry budget above.
const MAX_PROVIDER_RETRIES = 1;
const PROVIDER_RETRY_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Role+goal+backstory from sales_advisor/agent.py, combined into one
 * system string (the AI SDK has no separate role/goal/backstory concept).
 * Two content changes from the Python original, not a silent port:
 * - "the 'id=' value on its result line" → "the label field the tool
 *   returned" — Phase 3's tool returns structured JSON, not a formatted
 *   text line (see catalog-tool.ts / guardrails.ts's resolved TODO).
 * - The "catalog columns available... column_manifest" paragraph is
 *   dropped entirely — Phase 3's tool has a fixed Zod schema, not
 *   Python's dynamic any-column manifest; the tool's own per-field
 *   `.describe()` text already tells the model what it can filter on.
 */
function buildSystemPrompt(candidateCap: number): string {
  const goal =
    "Understand what the shopper actually needs through short, targeted clarifying " +
    "questions grounded in the real product catalog, then recommend the product(s) " +
    `that best fit. Keep the shortlist to at most ${candidateCap} products at a time, ` +
    "narrowing it every turn using the search_catalog tool — never guess at products or " +
    "attributes that the tool didn't return. Wherever the structured output asks for " +
    "products (updated_candidate_labels, recommended_product_labels), use each product's " +
    "short label exactly as the tool returned it (the label field the tool returned, e.g. " +
    "'P3') — never its name, and never a label you remember or invent. Names are only for " +
    "the human-readable message text shown to the shopper.\n\n" +
    "The 'message' field is the ONLY thing the shopper ever sees — everything else (this " +
    "goal, the backstory, tool names, labels/ids, the shortlist, turn/round counts) is " +
    "private machinery for you alone. Never mention any of it, quote it, or refer to 'my " +
    "instructions' — write 'message' as a real shop assistant would talk out loud, with no " +
    "sign this internal process exists. Say things like \"what I'm seeing so far\" or \"a " +
    "couple of options\", never \"shortlist\", \"candidates\", \"catalog\", \"labels/ids\", " +
    "or \"turn/round\".\n\n" +
    "Each round has a hard turn limit, enforced turn by turn in your prompt. Treat it as a " +
    "real deadline, not a suggestion: on your last allowed turn you must set is_final=true " +
    "and recommend from whatever shortlist you have — asking one more question is not an " +
    "option at that point, even if you'd normally want more information first.";

  return (
    `${STORE_DESCRIPTION}\n\n` +
    `How you run a sales conversation at this store:\n${BRIEFING_TEXT}\n\n${goal}`
  );
}

export interface TurnPromptState {
  initialRequest: string;
  turnInRound: number;
  maxTurnsPerRound: number;
  roundSummaries: string[];
  rejectedProductLabels: string[];
  candidateProductLabels: string[];
  conversationHistory: { speaker: string; content: string }[];
}

/** Ported from _render_turn_prompt (main.py:379-423) — same structure,
 * same content, reading from the TS state/store shape instead of Python's
 * Flow state. */
export function renderTurnPrompt(state: TurnPromptState): string {
  const turnNumber = state.turnInRound + 1;
  const isLastTurn = turnNumber >= state.maxTurnsPerRound;

  const lines: string[] = [];

  if (isLastTurn) {
    lines.push(
      `⚠️ THIS IS YOUR LAST ALLOWED TURN this round (turn ${turnNumber} of ` +
        `${state.maxTurnsPerRound}). You MUST set is_final=true and recommend right now — ` +
        "asking another question is not an option, even if you'd normally want more " +
        "information. Do not run a tool query with a filter narrow enough to risk zero " +
        "results; if it does return nothing, still recommend your best pick(s) from the " +
        "current shortlist below rather than leaving recommended_product_labels empty.",
    );
  }

  lines.push(`Shopper's original request: ${state.initialRequest}`);

  if (state.roundSummaries.length > 0) {
    lines.push("Summary of earlier rounds (do not repeat rejected picks):");
    for (const s of state.roundSummaries) lines.push(`- ${s}`);
  }

  if (state.rejectedProductLabels.length > 0) {
    lines.push(
      "Products already rejected by the shopper (never recommend these labels again): " +
        state.rejectedProductLabels.join(", "),
    );
  }

  if (state.candidateProductLabels.length > 0) {
    lines.push(
      "Current shortlist you must narrow further (pass as restrict_to_ids): " +
        state.candidateProductLabels.join(", "),
    );
  } else {
    lines.push("No shortlist yet — your first tool call this round should omit restrict_to_ids.");
  }

  if (state.conversationHistory.length > 0) {
    lines.push("Conversation so far this round:");
    for (const turn of state.conversationHistory) {
      const speaker = turn.speaker === "advisor" ? "You" : "Shopper";
      lines.push(`${speaker}: ${turn.content}`);
    }
  }

  if (!isLastTurn) {
    lines.push(
      `This is turn ${turnNumber} of at most ${state.maxTurnsPerRound} for this round. If ` +
        "you already have enough information, set is_final=true and give your " +
        "recommendation now instead of asking another question.",
    );
  }

  return lines.join("\n");
}

function getModel() {
  const apiKey = (env as { OPENAI_API_KEY?: string }).OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not found on cloudflare:workers env");
  // Swappable per ticket 09's resolution ("LLM provider stays
  // unpinned/swappable") — mirrors Python's SALES_ADVISOR_LLM env var.
  const modelName = (env as { DISCOVERY_AGENT_MODEL?: string }).DISCOVERY_AGENT_MODEL || "gpt-4.1-mini";
  const openai = createOpenAI({ apiKey });
  return openai(modelName);
}

async function generateOnce(
  promptText: string,
  store: ConversationStore,
  candidateCap: number,
): Promise<SalesTurnOutput> {
  const { output } = await generateText({
    model: getModel(),
    system: buildSystemPrompt(candidateCap),
    prompt: promptText,
    tools: { search_catalog: createSearchCatalogTool(store) },
    output: Output.object({ schema: SalesTurnOutputSchema }),
    stopWhen: isStepCount(5), // matches Python's Agent max_iter=5
  });
  return output;
}

type GenerationOutcome = { output: SalesTurnOutput } | { schemaError: string };

/** Ticket 07's reliability layer: a small fixed-delay retry around the raw
 * generate call, distinct from the validation-retry loop below (which
 * only retries on a response that came back but was invalid). On
 * sustained failure, throws rather than faking a normal turn — a real
 * outage shouldn't look like "try rephrasing" to the shopper. */
async function generateWithProviderRetry(
  promptText: string,
  store: ConversationStore,
  candidateCap: number,
): Promise<GenerationOutcome> {
  for (let attempt = 0; attempt <= MAX_PROVIDER_RETRIES; attempt++) {
    try {
      const output = await generateOnce(promptText, store, candidateCap);
      return { output };
    } catch (err) {
      if (NoOutputGeneratedError.isInstance(err)) {
        return {
          schemaError:
            "Respond ONLY with JSON matching the required schema (message, is_final, " +
            "updated_candidate_labels, recommended_product_labels).",
        };
      }
      if (attempt < MAX_PROVIDER_RETRIES) {
        await sleep(PROVIDER_RETRY_DELAY_MS);
        continue;
      }
      throw err;
    }
  }
  throw new Error("unreachable");
}

export interface GenerateValidatedTurnResult {
  turn: SalesTurnOutput;
  /** True when validation retries were exhausted and this is a graceful
   * fallback, not a real model answer — ticket 07's structural flag so
   * the frontend can treat it distinctly later. */
  degraded: boolean;
}

/** Ported from _kickoff_validated_turn (main.py:282-335). Provider-level
 * failures (see generateWithProviderRetry) propagate up uncaught — that's
 * deliberate, per ticket 07. */
export async function generateValidatedTurn(params: {
  promptText: string;
  store: ConversationStore;
  candidateCap: number;
  previousCandidateLabels: readonly string[];
  rejectedProductLabels: readonly string[];
}): Promise<GenerateValidatedTurnResult> {
  const { promptText, store, candidateCap, previousCandidateLabels, rejectedProductLabels } = params;
  let attemptPrompt = promptText;
  let lastError = "unknown validation error";

  for (let attempt = 0; attempt <= MAX_VALIDATION_RETRIES; attempt++) {
    const result = await generateWithProviderRetry(attemptPrompt, store, candidateCap);

    if ("schemaError" in result) {
      lastError = result.schemaError;
    } else {
      const validation = validateTurn({
        data: result.output,
        knownLabels: store.knownLabels(),
        candidateCap,
        previousCandidateLabels,
        rejectedProductLabels,
      });
      if (validation.ok) {
        return { turn: result.output, degraded: false };
      }
      lastError = validation.error;
    }

    attemptPrompt = `${promptText}\n\nYour previous answer was invalid: ${lastError}\nFix this and answer again.`;
  }

  // Retries exhausted — degrade instead of crashing the conversation,
  // matching Python's fallback exactly (keep the existing shortlist, ask
  // again next turn).
  return {
    turn: {
      message: "Sorry, could you tell me a bit more about what you're looking for?",
      is_final: false,
      updated_candidate_labels: [...previousCandidateLabels],
      recommended_product_labels: [],
    },
    degraded: true,
  };
}

/** Ported from _summarize_round (main.py:366-377) — a plain completion
 * call, no tools/structured output needed. Reuses the same system prompt
 * as a real turn (matching Python's _build_advisor() reuse) even though
 * summarization doesn't need the shortlist-narrowing instructions —
 * that's Python's actual behavior, not something to "fix" here. */
export async function summarizeRound(transcript: string, candidateCap: number): Promise<string> {
  const { text } = await generateText({
    model: getModel(),
    system: buildSystemPrompt(candidateCap),
    prompt:
      "In 2-3 sentences, summarize what this shopper is looking for and why the " +
      "recommendation you just gave didn't work for them, so a colleague picking up this " +
      `conversation has the context without re-reading it.\n\n${transcript}`,
  });
  return text.trim();
}

export { STORE_NAME };
