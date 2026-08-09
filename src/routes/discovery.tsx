import { createFileRoute } from "@tanstack/react-router";
import DiscoveryChat from "~/components/discovery/DiscoveryChat";

/**
 * The real discovery-chat Agent, at the same `/discovery` URL and visual
 * shell the earlier scripted mock (deleted, then restored per a later
 * decision) used — chat panel + avatar + prompt chips on the left, a
 * "Recommended"/"Your set" sidebar on the right. `/fragrance` stays the
 * plain filter/grid catalog, a separate page again (not a secondary path
 * under this one).
 *
 * `c` search param: the active conversation id, for logged-in shoppers'
 * chat history (useDiscoveryChat.ts). Omitted, it resolves to the most
 * recently updated conversation (or a fresh one if none exist yet);
 * present, it switches to that specific one — set by the sidebar's
 * "New chat"/history-item clicks, not typed by hand, but still a real
 * URL so a conversation is bookmarkable/shareable-in-spirit.
 */
export const Route = createFileRoute("/discovery")({
  component: DiscoveryChat,
  validateSearch: (search: Record<string, unknown>): { c?: string } => ({
    c: typeof search.c === "string" ? search.c : undefined,
  }),
});
