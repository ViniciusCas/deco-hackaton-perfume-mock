import { createFileRoute } from "@tanstack/react-router";
import { useUser } from "~/platform/user";
import { useCatalogGaps } from "~/platform/discovery";
import Button from "~/components/ui/Button";

/**
 * Turns the discovery-agent's own transcripts into an ops-facing signal:
 * every time a shopper rejects a recommendation, agent.ts already asks
 * the LLM to summarize what they wanted and why it missed
 * (turn-generation.ts's summarizeRound) — previously used only to steer
 * that one conversation's next round, now also kept as a standing record
 * across every conversation. This page just lists it, newest first — no
 * aggregation/clustering yet, that's the natural next step once there's
 * enough volume to make patterns visible by eye.
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

function CatalogGapsPage() {
  const { isAuthenticated, isLoading: userLoading } = useUser();
  const { gaps, isLoading: gapsLoading } = useCatalogGaps(isAuthenticated);

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
          What shoppers asked the scent assistant for, and why the catalog couldn't quite
          deliver — one entry per rejected recommendation round.
        </p>
      </div>

      {gapsLoading ? (
        <div className="flex justify-center py-16">
          <span className="loading loading-spinner loading-lg" />
        </div>
      ) : gaps.length === 0 ? (
        <div className="frost rounded-lg p-8 text-center text-sm text-muted">
          No gap signals recorded yet — this fills in as shoppers reject recommendations
          in the discovery chat.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {gaps.map((gap) => (
            <li key={gap.id} className="frost rounded-lg p-5">
              <div className="mb-2 flex items-center justify-between text-xs text-muted">
                <span>Conversation {gap.conversationId.slice(0, 8)}</span>
                <span>{relativeTime(gap.createdAt)}</span>
              </div>
              <p className="text-sm leading-relaxed text-ink">{gap.summary}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
