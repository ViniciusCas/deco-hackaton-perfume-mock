import { useEffect, useState } from "react";
import { useAgent } from "agents/react";
import type { DiscoveryAgent } from "~/agents/discovery/agent";
import type { DiscoveryAgentState } from "~/agents/discovery/state";

interface TraceMessage {
  speaker: string;
  content: string;
}

/**
 * The "full drill-down" half of tracing a catalog-gap signal back to its
 * source: rather than duplicating a conversation's transcript into
 * discovery_catalog_gaps (schema.ts's comment on that table), this
 * connects live to the exact DiscoveryAgent Durable Object that produced
 * the signal — by `conversationId`, the same identity useDiscoveryChat.ts
 * uses for a real shopper's own session — and pulls its already-persisted
 * transcript (this.sql, never cleared, per agent.ts's getConversationHistory).
 * Mounted on demand (an expand toggle on the insights page), not
 * eagerly, so this doesn't open a connection per row on page load.
 */
export default function ConversationTrace({ conversationId }: { conversationId: string }) {
  const [history, setHistory] = useState<TraceMessage[] | null>(null);
  const [error, setError] = useState(false);
  const agent = useAgent<DiscoveryAgent, DiscoveryAgentState>({
    agent: "discovery-agent",
    name: conversationId,
  });

  useEffect(() => {
    let cancelled = false;
    setHistory(null);
    setError(false);
    (async () => {
      try {
        await agent.ready;
        const result = await agent.call("getConversationHistory", []);
        if (!cancelled) setHistory(result as TraceMessage[]);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agent, conversationId]);

  if (error) {
    return <p className="text-xs text-muted">Couldn't load this conversation.</p>;
  }

  if (!history) {
    return (
      <div className="flex justify-center py-4">
        <span className="loading loading-spinner loading-sm" />
      </div>
    );
  }

  if (history.length === 0) {
    return <p className="text-xs text-muted">No messages recorded for this conversation.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {history.map((m, i) => (
        <div
          key={i}
          className={`max-w-[90%] rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
            m.speaker === "advisor"
              ? "self-start bg-blush-deep text-ink"
              : "self-end bg-accent text-black"
          }`}
        >
          {m.content}
        </div>
      ))}
    </div>
  );
}
