import { createFileRoute } from "@tanstack/react-router";
import { routeAgentRequest } from "agents";
// @ts-expect-error -- ambient Cloudflare Workers module, no local types
import { env } from "cloudflare:workers";

/**
 * Routes /agents/discovery-agent/<id> (WebSocket + RPC) to the
 * DiscoveryAgent Durable Object. `routeAgentRequest` resolves the instance
 * from the DISCOVERY_AGENT binding (see wrangler.jsonc) via the URL's
 * kebab-case segment — the DO class itself is exported from
 * src/worker-entry.ts, not this file, since Cloudflare requires the class
 * exported from the module named in wrangler.jsonc's `main`.
 *
 * Must return routeAgentRequest's Response completely unwrapped — any
 * wrapping/reconstruction breaks the WebSocket upgrade.
 */
async function handleAgentRequest({ request }: { request: Request }) {
  const response = await routeAgentRequest(request, env);
  return response ?? new Response("Not found", { status: 404 });
}

export const Route = createFileRoute("/agents/$")({
  server: {
    handlers: {
      GET: handleAgentRequest,
      POST: handleAgentRequest,
    },
  },
});
