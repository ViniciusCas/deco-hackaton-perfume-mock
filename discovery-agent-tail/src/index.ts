/**
 * Ticket 08's decided observability backbone: a dedicated Tail Worker,
 * consuming the Agents SDK's diagnostics_channel events automatically (no
 * subscription code needed in the agent itself — see
 * sales-agent/.scratch/discovery-agent-architecture/build-plan.md Phase 0's
 * snippet). Deliberately its own tiny Worker, not folded into the main
 * app's `instrumentWorker` pipeline — Phase 5's investigation found that
 * pipeline is scoped to the main Worker's own `fetch()` calls and never
 * reaches code running inside the DiscoveryAgent Durable Object, so a Tail
 * Worker is a genuinely different (and necessary) mechanism, not a
 * duplicate of it.
 *
 * Also picks up Phase 5's plain `console.log`/`console.error` calls in
 * `agent.ts`/`turn-generation.ts`/`catalog-tool.ts` for free — a Tail
 * Worker receives everything (`event.logs`, `event.exceptions`,
 * `event.diagnosticsChannelEvents`) for the Worker(s) it's attached to, not
 * just the SDK's own channels, so both mechanisms end up flowing through
 * this one place. `console.log` output here is captured by Cloudflare
 * Workers Logs same as any other Worker.
 */
export default {
  async tail(events: TraceItem[]): Promise<void> {
    for (const event of events) {
      for (const msg of event.diagnosticsChannelEvents) {
        console.log("discovery-tail:diagnostics", msg.channel, JSON.stringify(msg.message));
      }
      for (const log of event.logs) {
        console.log("discovery-tail:log", log.level, JSON.stringify(log.message));
      }
      for (const exception of event.exceptions) {
        console.error("discovery-tail:exception", exception.name, exception.message);
      }
    }
  },
};
