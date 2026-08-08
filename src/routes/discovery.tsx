import { createFileRoute } from "@tanstack/react-router";
import DiscoveryChat from "~/components/discovery/DiscoveryChat";

/**
 * The real discovery-chat Agent, at the same `/discovery` URL and visual
 * shell the earlier scripted mock (deleted, then restored per a later
 * decision) used — chat panel + avatar + prompt chips on the left, a
 * "Recommended"/"Your set" sidebar on the right. `/fragrance` stays the
 * plain filter/grid catalog, a separate page again (not a secondary path
 * under this one).
 */
export const Route = createFileRoute("/discovery")({
  component: DiscoveryChat,
});
