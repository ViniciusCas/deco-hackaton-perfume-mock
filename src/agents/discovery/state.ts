/**
 * State model for the discovery-chat Agent, split per ticket 05's guidance
 * (small live scalars in `this.state`, growing/unbounded data in
 * `this.sql` tables — putting a growing list in `this.state` broadcasts
 * the whole thing to every connected client on every write). Ported from
 * sales-agent's SalesConversationState
 * (sales-agent/src/ecommerce_sales_flow/main.py:172-190).
 *
 * Unlike SalesTurnOutputSchema (schemas.ts), these field names are
 * camelCase — this state never gets sent to the LLM as a schema, it's pure
 * internal bookkeeping, so this app's usual naming convention applies.
 *
 * Python's version also carried store_name/store_description/briefing_text/
 * column_manifest here, since it loaded them from files at Flow boot and
 * needed to pass them along. This port doesn't: they're static constants
 * (store-config.ts) imported directly wherever needed (turn-generation.ts),
 * not per-conversation data, so keeping them in state would just be
 * duplication with no purpose. `column_manifest` specifically has no TS
 * equivalent at all — Phase 3's catalog tool has a fixed Zod schema, not
 * Python's dynamic "any column the CSV happens to have" manifest.
 *
 * One more deliberate divergence, from Phase 4: Python's `final_recommendation`
 * is a formatted text blob (name/price/description lines) built for a
 * terminal UI. Per ticket 10's resolution, the real frontend renders
 * recommendations via the existing `ProductTile` component, not text — so
 * this holds the recommended product LABELS instead; the frontend
 * fetches/renders full product data from those, same as everywhere else.
 */
import { CANDIDATE_CAP, MAX_TURNS_PER_ROUND } from "./store-config";

/** `this.state` — small, changes every turn, fine to broadcast. */
export interface DiscoveryAgentState {
  initialRequest: string;
  roundCount: number;
  turnInRound: number;
  maxTurnsPerRound: number;
  candidateCap: number;
  isComplete: boolean;
  finalRecommendationLabels: string[];
  /** Labels awaiting an accept/reject decision — empty when no
   * recommendation is currently pending. Has to live in state (not a
   * local variable) since respondToRecommendation is a separate RPC call
   * that may arrive well after submitTurn already returned the
   * recommendation, possibly after a reconnect. */
  pendingRecommendationLabels: string[];
  /** Ticket 07's "repeated-failure escalation": counts consecutive
   * validation-exhaustion (degraded) turns, reset to 0 by any normal
   * turn. Used to append a "browse instead" pointer after 2 in a row —
   * see turn-generation.ts / agent.ts's generateAndApplyTurn. */
  consecutiveDegradedTurns: number;
}

export const INITIAL_DISCOVERY_AGENT_STATE: DiscoveryAgentState = {
  initialRequest: "",
  roundCount: 0,
  turnInRound: 0,
  maxTurnsPerRound: MAX_TURNS_PER_ROUND,
  candidateCap: CANDIDATE_CAP,
  isComplete: false,
  finalRecommendationLabels: [],
  pendingRecommendationLabels: [],
  consecutiveDegradedTurns: 0,
};

export type SqlFn = <T = Record<string, string | number | boolean | null>>(
  strings: TemplateStringsArray,
  ...values: (string | number | boolean | null)[]
) => T[];

interface HistoryRow {
  round: number;
  speaker: string;
  content: string;
}

interface RoundSummaryRow {
  round: number;
  summary: string;
}

interface LabelRow {
  label: string;
}

interface ProductLabelRow {
  label: string;
  product_id: string;
}

/**
 * Owns every `this.sql` table this Agent needs — growing conversation
 * history, round summaries, the current candidate/rejected label lists,
 * and the per-conversation product-label registry (P1, P2, ... short
 * aliases for real catalog ids). That registry is the TS equivalent of
 * sales-agent's Catalog._label_by_id/_id_by_label/_next_label
 * (sales-agent/src/ecommerce_sales_flow/sales_advisor/catalog.py:52-89) —
 * flagged as needing a home during the guardrail port (guardrails.ts),
 * built here since it's real per-conversation state, not tool logic.
 */
export class ConversationStore {
  constructor(private readonly sql: SqlFn) {}

  /** Idempotent — safe to call on every Agent wake, matching how `agents`
   * itself runs its own schema init on every wake (see agent.ts). */
  ensureTables(): void {
    this.sql`
      CREATE TABLE IF NOT EXISTS conversation_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        round INTEGER NOT NULL,
        speaker TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER DEFAULT (unixepoch())
      )
    `;
    this.sql`
      CREATE TABLE IF NOT EXISTS round_summaries (
        round INTEGER PRIMARY KEY,
        summary TEXT NOT NULL
      )
    `;
    this.sql`
      CREATE TABLE IF NOT EXISTS candidate_product_labels (
        label TEXT PRIMARY KEY
      )
    `;
    this.sql`
      CREATE TABLE IF NOT EXISTS rejected_product_labels (
        label TEXT PRIMARY KEY
      )
    `;
    this.sql`
      CREATE TABLE IF NOT EXISTS product_labels (
        label TEXT PRIMARY KEY,
        product_id TEXT NOT NULL UNIQUE
      )
    `;
  }

  // -- conversation_history: round-tagged, kept (not deleted) on rollover
  // so a resumed session stays reconstructible — see ticket 06's answer. --

  recordTurn(round: number, speaker: "advisor" | "shopper", content: string): void {
    this.sql`INSERT INTO conversation_history (round, speaker, content) VALUES (${round}, ${speaker}, ${content})`;
  }

  historyForRound(round: number): { speaker: string; content: string }[] {
    return this.sql<HistoryRow>`
      SELECT round, speaker, content FROM conversation_history
      WHERE round = ${round} ORDER BY id ASC
    `;
  }

  /** Every round's turns, in chronological order — for reconstructing a
   * resumed client's full transcript. Distinct from historyForRound, which
   * intentionally scopes the LLM's own prompt to just the current round
   * (round_summaries carry the gist of earlier ones instead). */
  allHistory(): { speaker: string; content: string }[] {
    return this.sql<HistoryRow>`
      SELECT round, speaker, content FROM conversation_history ORDER BY id ASC
    `;
  }

  // -- round_summaries: persist across rounds --

  addRoundSummary(round: number, summary: string): void {
    this.sql`INSERT INTO round_summaries (round, summary) VALUES (${round}, ${summary})`;
  }

  allRoundSummaries(): string[] {
    return this.sql<RoundSummaryRow>`SELECT summary FROM round_summaries ORDER BY round ASC`.map(
      (r) => r.summary,
    );
  }

  // -- candidate/rejected labels: cleared and rebuilt each turn/round by
  // the caller (main.py's semantics — updated_candidate_labels replaces
  // the prior shortlist wholesale each turn, rejected labels accumulate). --

  setCandidateLabels(labels: readonly string[]): void {
    this.sql`DELETE FROM candidate_product_labels`;
    for (const label of labels) {
      this.sql`INSERT INTO candidate_product_labels (label) VALUES (${label})`;
    }
  }

  candidateLabels(): string[] {
    return this.sql<LabelRow>`SELECT label FROM candidate_product_labels`.map((r) => r.label);
  }

  addRejectedLabels(labels: readonly string[]): void {
    for (const label of labels) {
      this.sql`INSERT OR IGNORE INTO rejected_product_labels (label) VALUES (${label})`;
    }
  }

  rejectedLabels(): string[] {
    return this.sql<LabelRow>`SELECT label FROM rejected_product_labels`.map((r) => r.label);
  }

  clearCandidatesForNewRound(): void {
    this.sql`DELETE FROM candidate_product_labels`;
  }

  // -- product label registry: short P1/P2/... aliases for real catalog
  // ids, assigned lazily the first time a product is returned by a query,
  // stable for the rest of the conversation. --

  /** Return this product's short label, assigning one if it's new. */
  labelForId(productId: string): string {
    const existing = this.sql<ProductLabelRow>`
      SELECT label FROM product_labels WHERE product_id = ${productId}
    `;
    if (existing.length > 0) return existing[0].label;

    const [{ n }] = this.sql<{ n: number }>`SELECT COUNT(*) as n FROM product_labels`;
    const label = `P${n + 1}`;
    this.sql`INSERT INTO product_labels (label, product_id) VALUES (${label}, ${productId})`;
    return label;
  }

  idForLabel(label: string): string | null {
    const rows = this.sql<ProductLabelRow>`
      SELECT product_id FROM product_labels WHERE label = ${label}
    `;
    return rows.length > 0 ? rows[0].product_id : null;
  }

  /** Resolve known labels to real ids, silently dropping unknown ones. */
  idsForLabels(labels: readonly string[]): string[] {
    return labels
      .map((label) => this.idForLabel(label))
      .filter((id): id is string => id !== null);
  }

  knownLabels(): Set<string> {
    return new Set(this.sql<LabelRow>`SELECT label FROM product_labels`.map((r) => r.label));
  }
}
