import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useUser } from "~/platform/user";
import { useCatalogGaps } from "~/platform/discovery";
import Button from "~/components/ui/Button";
import ConversationTrace from "~/components/discovery/ConversationTrace";

/**
 * Turns the discovery-agent's own conversations into an ops-facing signal
 * about the catalog, split into two sections with very different
 * evidentiary weight (schema.ts's discoveryGapKind comment has the full
 * reasoning):
 * - Zero-result searches: hard facts — the exact filter combo a
 *   search_catalog call used when it got 0 rows back, grouped/counted by
 *   exact match so a single shopper's one-off filter doesn't read the
 *   same as three different shoppers hitting the same empty filter.
 * - Rejected recommendations: the LLM's own narrative of what a shopper
 *   wanted and why a recommendation missed — useful context, but an
 *   interpretation, not a fact, so it stays as an individual list rather
 *   than counted/grouped.
 * Degraded (validation-exhaustion) turns are filtered out entirely before
 * either ever reaches this page (agent.ts's rejection branch).
 *
 * Every entry also carries its own trace: the shopper's opening ask
 * (initialRequest, stored directly on the row) plus an on-demand "View
 * full conversation" toggle that connects live to that exact
 * conversation's DiscoveryAgent and pulls its real, already-persisted
 * transcript (ConversationTrace.tsx) — not a snapshot, the source of
 * truth itself.
 *
 * Gated on any logged-in session, same limitation as the server function
 * (discovery.actions.ts) — there's no staff/admin role in this app yet.
 */
export const Route = createFileRoute("/insights/catalog-gaps")({
  component: CatalogGapsPage,
});

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function TraceToggle({ conversationId }: { conversationId: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="tap-scale text-xs font-medium text-accent underline"
      >
        {expanded ? "Hide full conversation" : "View full conversation →"}
      </button>
      {expanded && (
        <div className="mt-3 rounded-lg border border-line bg-surface p-3">
          <ConversationTrace conversationId={conversationId} />
        </div>
      )}
    </div>
  );
}

function CatalogGapsPage() {
  const { isAuthenticated, isLoading: userLoading } = useUser();
  const { summaries, zeroResultGroups, isLoading: gapsLoading } = useCatalogGaps(isAuthenticated);

  if (userLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center pt-[90px] sm:pt-[110px]">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4 pt-[90px] sm:pt-[110px]">
        <div className="frost w-full max-w-md rounded-lg p-8 text-center">
          <h1 className="mb-2 font-display text-2xl font-normal text-ink">You're not signed in</h1>
          <p className="mb-6 text-sm text-muted">Sign in to view catalog-gap signals.</p>
          <Button href="/login" variant="solid" size="md">
            Go to sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pt-[90px] pb-14 sm:px-8 sm:pt-[110px]">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-light text-ink">Catalog gap signals</h1>
        <p className="mt-1 text-sm text-muted">
          What the discovery chat couldn't satisfy — grouped, hard-fact searches first, then
          the assistant's own read on why a recommendation didn't land. Every entry traces
          back to the conversation it came from.
        </p>
      </div>

      {gapsLoading ? (
        <div className="flex justify-center py-16">
          <span className="loading loading-spinner loading-lg" />
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          <section>
            <h2 className="mb-1 font-display text-lg font-medium text-ink">Zero-result searches</h2>
            <p className="mb-4 text-xs text-muted">
              Exact filter combinations that came back empty — counted by how many times the
              same combination happened, across any number of shoppers.
            </p>
            {zeroResultGroups.length === 0 ? (
              <div className="frost rounded-lg p-6 text-center text-sm text-muted">
                No zero-result searches recorded yet.
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {zeroResultGroups.map((group) => (
                  <li key={JSON.stringify(group.filters)} className="frost rounded-lg p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm leading-relaxed text-ink">{group.summary}</p>
                        {group.exampleInitialRequest && (
                          <p className="mt-1.5 text-xs text-muted">
                            From a conversation that started: “{group.exampleInitialRequest}”
                          </p>
                        )}
                        <p className="mt-1 text-xs text-muted">
                          Last seen {relativeTime(group.lastSeenAt)}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-rose px-2.5 py-1 text-xs font-medium text-black">
                        ×{group.count}
                      </span>
                    </div>
                    <TraceToggle conversationId={group.exampleConversationId} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-1 font-display text-lg font-medium text-ink">
              Rejected recommendations
            </h2>
            <p className="mb-4 text-xs text-muted">
              The assistant's own summary of what a shopper wanted and why the pick it made
              didn't land — one entry per rejected round.
            </p>
            {summaries.length === 0 ? (
              <div className="frost rounded-lg p-6 text-center text-sm text-muted">
                No rejected-recommendation summaries recorded yet.
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {summaries.map((s) => (
                  <li key={s.id} className="frost rounded-lg p-5">
                    <div className="mb-2 flex items-center justify-between text-xs text-muted">
                      <span>
                        Conversation {s.conversationId.slice(0, 8)}
                        {s.roundCount !== null ? ` · round ${s.roundCount + 1}` : ""}
                      </span>
                      <span>{relativeTime(s.createdAt)}</span>
                    </div>
                    <p className="text-sm leading-relaxed text-ink">{s.summary}</p>
                    {s.initialRequest && (
                      <p className="mt-1.5 text-xs text-muted">
                        Started as: “{s.initialRequest}”
                      </p>
                    )}
                    <TraceToggle conversationId={s.conversationId} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
