import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import ProductTile from "~/components/home/ProductTile";
import type { CatalogEntry } from "~/platform/catalog";
import { useDiscoveryChat } from "~/agents/discovery/useDiscoveryChat";
import type { TurnResult } from "~/agents/discovery/agent";

/**
 * Discovery-chat UI — ticket 10's resolution: `/fragrance`'s new default
 * view (behind ticket 11's feature flag), replacing the old filter/grid as
 * the primary way to browse. That old UI moved to `/fragrance/browse` and
 * stays reachable via this component's "browse instead" link, not removed.
 */

const GREETING =
  "Hi! Tell me what you're looking for — an occasion, a mood, scents you already like — " +
  "and I'll help you find something worth trying.";

interface ChatMessage {
  speaker: "advisor" | "shopper";
  content: string;
}

type RecommendationTurn = Extract<TurnResult, { kind: "recommendation" }>;
type RecommendedProduct = RecommendationTurn["products"][number];

/** DiscoveryAgent's catalog tool returns a narrower row shape than
 * ProductTile's `CatalogEntry` (no `mood` — see catalog-tool.ts's
 * SillageProductRow). `mood` isn't actually read by ProductTile's
 * rendering (only name/image/slug/id/notes/price/rating/tag are), so an
 * empty placeholder is correct here, not a lossy workaround. */
function toCatalogEntry(row: RecommendedProduct): CatalogEntry {
  const tag = row.tag === "New" || row.tag === "Limited" ? row.tag : undefined;
  return { ...row, tag, mood: "" };
}

function Avatar({ mine }: { mine: boolean }) {
  return (
    <div
      className={`flex size-8 shrink-0 items-center justify-center rounded-full font-display text-xs ${
        mine ? "bg-blush-deep text-ink" : "bg-accent text-black"
      }`}
      aria-hidden="true"
    >
      {mine ? "You" : "S"}
    </div>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const mine = message.speaker === "shopper";
  return (
    <div className={`flex items-end gap-2.5 ${mine ? "flex-row-reverse" : ""}`}>
      <Avatar mine={mine} />
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2.5 text-sm ${
          mine ? "bg-blush-deep text-ink" : "bg-surface text-ink-soft"
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}

export default function DiscoveryChat() {
  const { agent, connecting } = useDiscoveryChat();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [recommendation, setRecommendation] = useState<RecommendationTurn | null>(null);
  const [accepted, setAccepted] = useState(false);
  const primed = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // One-shot history backfill for a resumed session — see agent.ts's
  // getConversationHistory. Guarded by a ref (not state) so StrictMode's
  // double-invoke in dev doesn't double-fetch.
  useEffect(() => {
    if (connecting || primed.current) return;
    primed.current = true;
    (async () => {
      await agent.ready;
      const history = await agent.call("getConversationHistory", []);
      if (history.length > 0) {
        setMessages(history as ChatMessage[]);
      }
      if (agent.state?.isComplete) setAccepted(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connecting]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, recommendation, accepted]);

  function applyResult(result: TurnResult) {
    setMessages((prev) => [...prev, { speaker: "advisor", content: result.message }]);
    if (result.kind === "recommendation") setRecommendation(result);
  }

  async function send() {
    const reply = input.trim();
    if (!reply || sending) return;
    setInput("");
    setMessages((prev) => [...prev, { speaker: "shopper", content: reply }]);
    setSending(true);
    try {
      const result = await agent.call("submitTurn", [reply]);
      applyResult(result);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          speaker: "advisor",
          content: "Something went wrong on my end — could you try that again?",
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  async function respond(acceptedChoice: boolean) {
    if (sending) return;
    setSending(true);
    try {
      const result = await agent.call("respondToRecommendation", [acceptedChoice]);
      setRecommendation(null);
      if (result.kind === "accepted") {
        setAccepted(true);
      } else {
        applyResult(result);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          speaker: "advisor",
          content: "Something went wrong on my end — could you try that again?",
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col px-4 pt-[90px] pb-14 sm:px-8 sm:pt-[110px]">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="font-display text-2xs font-medium tracking-(--tracking-label) text-ink uppercase">
            Discovery
          </div>
          <h1 className="font-display text-3xl font-light text-ink sm:text-4xl">
            Find your signature
          </h1>
        </div>
        <Link
          to="/fragrance/browse"
          className="font-display text-2xs font-medium tracking-(--tracking-label) text-accent uppercase hover:text-rose-deep"
        >
          Browse instead
        </Link>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-line bg-glass-strong/40 p-4 sm:p-6">
        {connecting ? (
          <p className="py-10 text-center text-sm text-muted">Connecting…</p>
        ) : (
          <>
            <Bubble message={{ speaker: "advisor", content: GREETING }} />
            {messages.map((m, i) => (
              <Bubble key={i} message={m} />
            ))}

            {recommendation && (
              <div className="flex flex-col gap-3 rounded-lg bg-surface p-3.5">
                <div className="grid grid-cols-2 gap-3">
                  {recommendation.products.map((row) => (
                    <ProductTile key={row.id} entry={toCatalogEntry(row)} />
                  ))}
                </div>
                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => respond(true)}
                    disabled={sending}
                    className="tap-scale flex-1 rounded-sm bg-rose px-4 py-2.5 text-sm font-medium text-black disabled:opacity-50"
                  >
                    I'll take it
                  </button>
                  <button
                    type="button"
                    onClick={() => respond(false)}
                    disabled={sending}
                    className="tap-scale flex-1 rounded-sm border border-line-strong px-4 py-2.5 text-sm text-ink disabled:opacity-50"
                  >
                    Show me something else
                  </button>
                </div>
              </div>
            )}

            {accepted && (
              <div className="rounded-lg bg-surface p-3.5 text-sm text-ink-soft">
                Great choice! You can find it in{" "}
                <Link to="/wishlist" className="text-accent underline">
                  your wishlist
                </Link>{" "}
                or keep{" "}
                <Link to="/fragrance/browse" className="text-accent underline">
                  browsing the full collection
                </Link>
                .
              </div>
            )}

            <div ref={bottomRef} />
          </>
        )}
      </div>

      {!connecting && !accepted && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="mt-4 flex gap-2.5"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tell me what you're looking for…"
            disabled={sending}
            className="flex-1 rounded-sm border border-line-strong bg-transparent px-4 py-3 text-sm text-ink focus:border-ink focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="tap-scale rounded-sm bg-rose px-5 py-3 text-sm font-medium text-black disabled:opacity-50"
          >
            Send
          </button>
        </form>
      )}
    </div>
  );
}
