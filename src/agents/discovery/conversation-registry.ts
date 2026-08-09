import { eq } from "drizzle-orm";
import { getDb } from "~/db/client";
import { discoveryConversations } from "~/db/schema";

const TITLE_MAX_LENGTH = 60;

function truncateTitle(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > TITLE_MAX_LENGTH ? `${trimmed.slice(0, TITLE_MAX_LENGTH)}…` : trimmed;
}

/**
 * Persists discovery-chat conversations for logged-in shoppers only —
 * guests get a single ephemeral session with nothing to list, so there's
 * no guest path here (agent.ts only calls this when it has a
 * `loggedInUserId`). `conversationId` is the DiscoveryAgent Durable
 * Object's own instance name — a conversation's identity in the DB and as
 * a live Agent are the same uuid, nothing to keep in sync between the two.
 *
 * Both functions swallow DB errors — a failed write here means a
 * conversation just won't show up (or won't reorder) in the history
 * sidebar; it should never break the conversation itself.
 */
export async function recordConversationStart(
  conversationId: string,
  userId: string,
  firstMessage: string,
): Promise<void> {
  try {
    const db = getDb();
    await db.insert(discoveryConversations).values({
      id: conversationId,
      userId,
      title: truncateTitle(firstMessage),
    });
  } catch (err) {
    console.error("discovery-agent:conversation-registry-insert-failed", err);
  }
}

export async function touchConversation(conversationId: string): Promise<void> {
  try {
    const db = getDb();
    await db
      .update(discoveryConversations)
      .set({ updatedAt: new Date() })
      .where(eq(discoveryConversations.id, conversationId));
  } catch (err) {
    console.error("discovery-agent:conversation-registry-touch-failed", err);
  }
}
