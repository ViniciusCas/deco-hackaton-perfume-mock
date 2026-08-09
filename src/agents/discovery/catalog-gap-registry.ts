import { getDb } from "~/db/client";
import { discoveryCatalogGaps } from "~/db/schema";
import type { CatalogFilters } from "~/platform/discovery/discovery.actions";

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
): Promise<void> {
  try {
    const db = getDb();
    await db.insert(discoveryCatalogGaps).values({
      conversationId,
      userId,
      kind: "rejection_summary",
      summary,
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
 */
export async function recordZeroResultSignal(
  conversationId: string,
  userId: string | null,
  filters: CatalogFilters,
): Promise<void> {
  try {
    const db = getDb();
    await db.insert(discoveryCatalogGaps).values({
      conversationId,
      userId,
      kind: "zero_result_query",
      filters,
    });
  } catch (err) {
    console.error("discovery-agent:catalog-gap-registry-insert-failed", err);
  }
}
