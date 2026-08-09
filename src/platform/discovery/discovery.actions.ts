import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { desc, eq } from "drizzle-orm";
import { getAuth } from "~/db/auth";
import { getDb } from "~/db/client";
import { discoveryConversations } from "~/db/schema";

export interface DiscoveryConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}

/**
 * Logged-in shoppers only — guests get a single ephemeral discovery-chat
 * session with nothing persisted (agents/discovery/conversation-registry.ts
 * never writes a row for them), so this returns `[]` rather than erroring.
 */
export const listDiscoveryConversationsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<DiscoveryConversationSummary[]> => {
    const request = getRequest();
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return [];

    const db = getDb();
    const rows = await db
      .select({
        id: discoveryConversations.id,
        title: discoveryConversations.title,
        updatedAt: discoveryConversations.updatedAt,
      })
      .from(discoveryConversations)
      .where(eq(discoveryConversations.userId, session.user.id))
      .orderBy(desc(discoveryConversations.updatedAt));

    return rows.map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString() }));
  },
);
