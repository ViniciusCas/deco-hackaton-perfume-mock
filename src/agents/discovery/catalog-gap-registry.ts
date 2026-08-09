import { getDb } from "~/db/client";
import { discoveryCatalogGaps } from "~/db/schema";
import type { CatalogFilters } from "~/platform/discovery/discovery.actions";

/** Where a signal comes from, within its own conversation — carried on
 * every row purely for traceability (schema.ts's discoveryCatalogGaps
 * comment): initialRequest is the shopper's own opening ask, roundCount
 * is which round of that conversation produced this signal. Neither is
 * derived or guessed — both come straight off `this.state` (agent.ts),
 * which already has them at the moment either signal is recorded. */
export interface GapTraceContext {
  initialRequest: string;
  roundCount: number;
}

function describeZeroResultFilters(filters: CatalogFilters): string {
  const parts: string[] = [];
  if (filters.search) parts.push(`search "${filters.search}"`);
  if (filters.family?.length) parts.push(`family ${filters.family.join("/")}`);
  if (filters.brand?.length) parts.push(`brand ${filters.brand.join("/")}`);
  if (typeof filters.priceMin === "number") parts.push(`price ≥ $${filters.priceMin}`);
  if (typeof filters.priceMax === "number") parts.push(`price ≤ $${filters.priceMax}`);
  const filterText = parts.length > 0 ? parts.join(", ") : "no filters";
  return `Search for ${filterText} returned nothing.`;
}

/**
 * Persists the "what this shopper wanted and why the recommendation
 * missed" summary already generated for every rejected round
 * (turn-generation.ts's summarizeRound, called from agent.ts's rejection
 * branch right before this) — previously only used to steer that
 * conversation's own next round, now also kept as a standing signal of
 * catalog gaps across every conversation, guest or signed-in. Unlike
 * conversation-registry.ts, this has no logged-in-only gate: a guest's
 * unmet request is just as useful an ops signal as a signed-in shopper's.
 *
 * This is the "rejection_summary" kind — an LLM interpretation, not a
 * hard fact (see schema.ts's discoveryGapKind comment for why that
 * matters for false positives). agent.ts's rejection branch skips this
 * call entirely when the rejected turn was degraded, since a
 * validation-exhaustion fallback's "summary" is an artifact of a broken
 * turn, not real shopper feedback.
 *
 * Swallows DB errors — a failed write here should never break the
 * conversation itself, only mean this round's signal is lost.
 */
export async function recordCatalogGapSignal(
  conversationId: string,
  userId: string | null,
  summary: string,
  trace: GapTraceContext,
): Promise<void> {
  try {
    const db = getDb();
    await db.insert(discoveryCatalogGaps).values({
      conversationId,
      userId,
      kind: "rejection_summary",
      summary,
      initialRequest: trace.initialRequest,
      roundCount: trace.roundCount,
    });
  } catch (err) {
    console.error("discovery-agent:catalog-gap-registry-insert-failed", err);
  }
}

/**
 * Persists the "zero_result_query" kind — the exact filter args a
 * search_catalog call used when it came back empty (catalog-tool.ts).
 * Unlike recordCatalogGapSignal's LLM narrative, this is a hard fact:
 * the model asked for exactly this combination and the catalog had
 * nothing matching it. `filters` is stored structured (jsonb), not as
 * free text, so /insights/catalog-gaps can group/count exact repeats of
 * the same combination instead of fuzzy-matching prose — a single
 * shopper's one-off filter shouldn't read as a trend the way three
 * different shoppers hitting the same empty filter should.
 *
 * `summary` here is a short, deterministically-templated one-liner (not
 * an LLM call — filters is already exact, there's nothing to
 * interpret), purely so both signal kinds render the same way on
 * /insights/catalog-gaps without special-casing which field to read.
 */
export async function recordZeroResultSignal(
  conversationId: string,
  userId: string | null,
  filters: CatalogFilters,
  trace: GapTraceContext,
): Promise<void> {
  try {
    const db = getDb();
    await db.insert(discoveryCatalogGaps).values({
      conversationId,
      userId,
      kind: "zero_result_query",
      summary: describeZeroResultFilters(filters),
      filters,
      initialRequest: trace.initialRequest,
      roundCount: trace.roundCount,
    });
  } catch (err) {
    console.error("discovery-agent:catalog-gap-registry-insert-failed", err);
  }
}
