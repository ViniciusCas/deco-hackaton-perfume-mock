import { Agent, callable } from "agents";

/**
 * Discovery-chat Agent — Phase 1 skeleton only (no business logic yet).
 * See sales-agent/.scratch/discovery-agent-architecture/build-plan.md.
 *
 * State/tool/turn-generation logic lands in later phases (2-4); this phase
 * proves the routing/binding/decorator plumbing works at all before
 * building anything on top of it. `ping` exists solely to verify that path
 * end-to-end via a real client call.
 */

// Env bindings this Agent needs. Extend as later phases add DB/API access —
// left minimal here since Phase 1 has nothing to bind yet beyond what
// `Agent`'s own generics require.
export interface Env {
  [key: string]: unknown;
}

export interface DiscoveryAgentState {
  // Populated in Phase 2 (round/turn counters, candidate_cap, is_complete,
  // final_recommendation, etc. — see build-plan.md's state-shape split).
  // Left empty in Phase 1: `initialState` needs a concrete value, but
  // there's nothing real to put in it yet.
  _placeholder?: never;
}

export class DiscoveryAgent extends Agent<Env, DiscoveryAgentState> {
  initialState: DiscoveryAgentState = {};

  @callable()
  ping(): string {
    return "pong";
  }
}
