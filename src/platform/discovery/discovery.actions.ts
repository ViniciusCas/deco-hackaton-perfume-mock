import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { desc, eq } from "drizzle-orm";
import { getAuth } from "~/db/auth";
import { getDb } from "~/db/client";
import { discoveryCatalogGaps, discoveryConversations } from "~/db/schema";

export interface DiscoveryConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export interface CatalogGapSignal {
  id: string;
  conversationId: string;
  summary: string;
  createdAt: string;
}

const CATALOG_GAPS_LIMIT = 100;

/**
 * Requires any logged-in session (not scoped to that user — this is an
 * ops-facing signal about the catalog as a whole, not personal data).
 * There's no role system in this app yet, so "logged in" is the only gate
 * available; tightening this to a real staff/admin role is a follow-up,
 * not something to fake here.
 */
export const listCatalogGapsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<CatalogGapSignal[]> => {
    const request = getRequest();
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return [];

    const db = getDb();
    const rows = await db
      .select({
        id: discoveryCatalogGaps.id,
        conversationId: discoveryCatalogGaps.conversationId,
        summary: discoveryCatalogGaps.summary,
        createdAt: discoveryCatalogGaps.createdAt,
      })
      .from(discoveryCatalogGaps)
      .orderBy(desc(discoveryCatalogGaps.createdAt))
      .limit(CATALOG_GAPS_LIMIT);

    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  },
);

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
