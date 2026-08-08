import { createFileRoute, redirect } from "@tanstack/react-router";
// @ts-expect-error -- ambient Cloudflare Workers module, no local types
import { env } from "cloudflare:workers";
import DiscoveryChat from "~/components/discovery/DiscoveryChat";

/**
 * Ticket 10/11's resolution: `/fragrance` becomes discovery-chat by
 * default, behind the `DISCOVERY_CHAT_ENABLED` flag (wrangler.jsonc) —
 * the old filter/grid UI that used to live at this path moved to
 * `/fragrance/browse` (fragrance.browse.tsx) unchanged. While the flag is
 * off, this route redirects there instead of duplicating that UI's code —
 * `FragrancePage`'s `Route.useSearch()`/`useNavigate()` calls are tied to
 * its own route match, so it can't just be re-rendered under this path.
 */
export const Route = createFileRoute("/fragrance/")({
  component: DiscoveryChat,
  loader: () => {
    const enabled = (env as { DISCOVERY_CHAT_ENABLED?: string }).DISCOVERY_CHAT_ENABLED === "1";
    if (!enabled) {
      throw redirect({ to: "/fragrance/browse", search: (prev) => prev, replace: true });
    }
  },
});
