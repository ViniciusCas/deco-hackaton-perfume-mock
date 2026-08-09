import { getDb } from "~/db/client";
import { discoveryCatalogGaps } from "~/db/schema";

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
    await db.insert(discoveryCatalogGaps).values({ conversationId, userId, summary });
  } catch (err) {
    console.error("discovery-agent:catalog-gap-registry-insert-failed", err);
  }
}
