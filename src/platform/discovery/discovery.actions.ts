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

/** The "rejection_summary" kind — an LLM narrative, kept as an
 * individual list rather than grouped since free text can't be
 * exact-matched the way structured filters can (see schema.ts's
 * discoveryGapKind comment). */
export interface RejectionSummarySignal {
  id: string;
  conversationId: string;
  summary: string;
  /** The shopper's own opening ask in this conversation, and which round
   * produced this signal — traceability context, not derived here (see
   * schema.ts's discoveryCatalogGaps comment). */
  initialRequest: string | null;
  roundCount: number | null;
  createdAt: string;
}

/** Mirrors search_catalog's input schema (catalog-tool.ts) minus `limit`/
 * `restrict_to_ids`, which aren't catalog-facing filters — see
 * catalog-tool.ts's zero-result branch, which strips exactly these two
 * before recording. Spelled out (not `Record<string, unknown>`) so this
 * stays JSON-serializable across the createServerFn boundary below. */
export interface CatalogFilters {
  search?: string;
  family?: string[];
  brand?: string[];
  priceMin?: number;
  priceMax?: number;
  sort?: string;
}

/** The "zero_result_query" kind, grouped by exact-matching `filters` —
 * `count` is how many times that exact combination came back empty, the
 * one piece of evidence that separates a real trend from a single
 * shopper's one-off filter (this file's grouping logic below). */
export interface ZeroResultGroup {
  filters: CatalogFilters;
  /** A short, deterministically-templated explanation of this filter
   * combination (catalog-gap-registry.ts's describeZeroResultFilters) —
   * every row in the group has the same one, since it's derived purely
   * from `filters`. */
  summary: string;
  count: number;
  lastSeenAt: string;
  exampleConversationId: string;
  /** The opening ask from one representative conversation in the group
   * (the most recent one) — traceability context, same reasoning as
   * RejectionSummarySignal.initialRequest above. */
  exampleInitialRequest: string | null;
}

export interface CatalogGapReport {
  summaries: RejectionSummarySignal[];
  zeroResultGroups: ZeroResultGroup[];
}

const CATALOG_GAPS_LIMIT = 300;

/**
 * Requires any logged-in session (not scoped to that user — this is an
 * ops-facing signal about the catalog as a whole, not personal data).
 * There's no role system in this app yet, so "logged in" is the only gate
 * available; tightening this to a real staff/admin role is a follow-up,
 * not something to fake here.
 */
export const listCatalogGapsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<CatalogGapReport> => {
    const request = getRequest();
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return { summaries: [], zeroResultGroups: [] };

    const db = getDb();
    const rows = await db
      .select({
        id: discoveryCatalogGaps.id,
        conversationId: discoveryCatalogGaps.conversationId,
        kind: discoveryCatalogGaps.kind,
        summary: discoveryCatalogGaps.summary,
        filters: discoveryCatalogGaps.filters,
        initialRequest: discoveryCatalogGaps.initialRequest,
        roundCount: discoveryCatalogGaps.roundCount,
        createdAt: discoveryCatalogGaps.createdAt,
      })
      .from(discoveryCatalogGaps)
      .orderBy(desc(discoveryCatalogGaps.createdAt))
      .limit(CATALOG_GAPS_LIMIT);

    const summaries: RejectionSummarySignal[] = rows
      .filter((r) => r.kind === "rejection_summary" && r.summary)
      .map((r) => ({
        id: r.id,
        conversationId: r.conversationId,
        summary: r.summary as string,
        initialRequest: r.initialRequest,
        roundCount: r.roundCount,
        createdAt: r.createdAt.toISOString(),
      }));

    // Group zero-result rows by their exact filter combination — a
    // single shopper's one-off empty query shouldn't read the same as
    // three different shoppers all hitting the same empty filter. Rows
    // arrive newest-first (the query's ORDER BY), so the first row seen
    // for a given key is always the most recent — that's the one kept
    // as the group's representative example.
    const groups = new Map<string, ZeroResultGroup>();
    for (const r of rows) {
      if (r.kind !== "zero_result_query" || !r.filters) continue;
      const key = JSON.stringify(r.filters);
      const existing = groups.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        groups.set(key, {
          filters: r.filters as CatalogFilters,
          summary: r.summary ?? "",
          count: 1,
          lastSeenAt: r.createdAt.toISOString(),
          exampleConversationId: r.conversationId,
          exampleInitialRequest: r.initialRequest,
        });
      }
    }
    const zeroResultGroups = [...groups.values()].sort(
      (a, b) => b.count - a.count || b.lastSeenAt.localeCompare(a.lastSeenAt),
    );

    return { summaries, zeroResultGroups };
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
