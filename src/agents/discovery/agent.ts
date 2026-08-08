import { Agent, callable } from "agents";
import {
  ConversationStore,
  INITIAL_DISCOVERY_AGENT_STATE,
  type DiscoveryAgentState,
} from "./state";

/**
 * Discovery-chat Agent. See
 * sales-agent/.scratch/discovery-agent-architecture/build-plan.md.
 *
 * Phase 1 proved the routing/binding/decorator plumbing works (`ping`,
 * still here for that same verification). Phase 2 added the real state
 * model — `this.state` for small live scalars, `this.sql` (via
 * `ConversationStore`) for growing conversation data. Phase 3 added the
 * catalog tool (catalog-tool.ts). Turn-generation logic (submitTurn),
 * wiring both together, lands in Phase 4.
 */

// Env bindings this Agent needs. Extend as later phases add DB/API access.
export interface Env {
  [key: string]: unknown;
}

export class DiscoveryAgent extends Agent<Env, DiscoveryAgentState> {
  initialState: DiscoveryAgentState = INITIAL_DISCOVERY_AGENT_STATE;

  private store!: ConversationStore;

  onStart(): void {
    this.store = new ConversationStore(this.sql.bind(this));
    this.store.ensureTables();
  }

  @callable()
  ping(): string {
    return "pong";
  }
}
