import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { useDiscoveryChat } from "~/agents/discovery/useDiscoveryChat";
import { PROMPTS, useDiscoveryConversation } from "~/agents/discovery/useDiscoveryConversation";

/**
 * Site-wide floating access to the discovery-chat Agent — the same
 * conversation engine as the full `/discovery` page (useDiscoveryConversation),
 * just in a compact widget so a shopper anywhere on the site can get a
 * quick recommendation without leaving the page they're on. Hidden on
 * `/discovery` itself: that page already IS this conversation, full-size —
 * stacking the bubble on top would just be two copies of the same chat.
 */
export default function DiscoveryBubble() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  // Mounted globally (root layout), on every page — useDiscoveryChat opens a
  // real Durable Object connection almost as soon as it runs (startClosed
  // only holds it shut until identity resolves, which is near-instant for
  // both guests and signed-in shoppers). Rendering DiscoveryBubblePanel only
  // once the shopper has actually opened the widget keeps that connection
  // (and the history/recommendation-state calls it fires on connect) from
  // firing on every single page view. Once opened, it stays mounted (just
  // visually hidden via CSS below) rather than unmounting on close, so
  // closing and reopening doesn't reconnect or re-fetch.
  const [everOpened, setEverOpened] = useState(false);

  if (location.pathname.startsWith("/discovery")) return null;

  return (
    <div className="fixed right-4 bottom-4 z-50 flex flex-col items-end gap-3 sm:right-6 sm:bottom-6">
      {everOpened && <DiscoveryBubblePanel open={open} onClose={() => setOpen(false)} />}

      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setEverOpened(true);
        }}
        aria-label={open ? "Close scent assistant chat" : "Open scent assistant chat"}
        className="tap-scale relative flex size-14 items-center justify-center rounded-full bg-accent text-black shadow-lg"
      >
        {/* Attention ring — only before the shopper has ever opened the
         * widget, so it invites a first click without pulsing forever. */}
        {!everOpened && (
          <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-accent opacity-60" />
        )}
        {open ? (
          <span className="text-xl leading-none">✕</span>
        ) : (
          <span className="font-display text-lg leading-none">✦</span>
        )}
      </button>
    </div>
  );
}

function DiscoveryBubblePanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [input, setInput] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const chat = useDiscoveryChat();
  const {
    agent,
    connecting,
    conversations,
    activeConversationId,
    canShowHistory,
    newConversation,
    switchConversation,
  } = chat;
  const {
    messages,
    busy,
    recommendation,
    acceptedSet,
    suggestedReplies,
    addingSlug,
    addedSlugs,
    isExistingConversation,
    ask,
    respond,
    addOne,
  } = useDiscoveryConversation(chat);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }, [messages, busy, open]);

  async function askAndClear(text: string) {
    setInput("");
    await ask(text);
  }

  function pickConversation(id: string) {
    switchConversation(id);
    setShowHistory(false);
  }

  function startNewConversation() {
    newConversation();
    setShowHistory(false);
  }

  const inputDisabled = connecting || busy || !!acceptedSet;
  const chips = messages.length <= 1 ? PROMPTS : suggestedReplies;

  return (
    <div
      className={`flex h-[70vh] max-h-[560px] w-[90vw] max-w-[380px] flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-xl ${
        open ? "" : "hidden"
      }`}
    >
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent font-display text-sm text-black">
          S
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-sm font-medium text-ink">Scent assistant</div>
          <div className="text-xs text-muted">
            {connecting
              ? "Connecting…"
              : isExistingConversation
                ? "Continuing your conversation"
                : "New conversation"}
          </div>
        </div>
        {canShowHistory && (
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            aria-label="Chat history"
            aria-pressed={showHistory}
            className={`tap-scale flex size-7 shrink-0 items-center justify-center rounded-sm text-ink-soft hover:bg-glass-strong ${
              showHistory ? "bg-glass-strong text-ink" : ""
            }`}
          >
            ☰
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat"
          className="tap-scale flex size-7 shrink-0 items-center justify-center rounded-sm text-ink-soft hover:bg-glass-strong"
        >
          ✕
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {showHistory && canShowHistory && (
          <div className="absolute inset-0 z-10 flex flex-col gap-2 overflow-y-auto bg-surface p-3">
            <button
              type="button"
              onClick={startNewConversation}
              className="tap-scale rounded-sm bg-rose px-3 py-2 text-sm font-medium text-black"
            >
              + New chat
            </button>
            {conversations.length === 0 ? (
              <p className="px-1 py-2 text-xs text-muted">No past conversations yet.</p>
            ) : (
              conversations.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => pickConversation(c.id)}
                  className={`tap-scale truncate rounded-sm px-3 py-2 text-left text-sm ${
                    c.id === activeConversationId
                      ? "bg-blush-deep text-ink"
                      : "text-ink-soft hover:bg-glass-strong"
                  }`}
                >
                  {c.title}
                </button>
              ))
            )}
          </div>
        )}

        <div ref={scrollRef} className="flex h-full flex-col gap-3 overflow-y-auto p-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                m.speaker === "advisor"
                  ? "self-start rounded-tl-md bg-blush-deep text-ink"
                  : "self-end rounded-tr-md bg-accent text-black"
              }`}
            >
              {m.content}
            </div>
          ))}
          {busy && (
            <div className="flex gap-1.5 self-start rounded-2xl rounded-tl-md bg-blush-deep px-4 py-3">
              <span className="size-1.5 animate-pulse rounded-full bg-muted" />
              <span className="size-1.5 animate-pulse rounded-full bg-muted [animation-delay:0.2s]" />
              <span className="size-1.5 animate-pulse rounded-full bg-muted [animation-delay:0.4s]" />
            </div>
          )}

          {recommendation && (
            <div className="flex flex-col gap-2 rounded-lg border border-line bg-blush p-3">
              {recommendation.products.map((p) => (
                <div key={p.id} className="flex items-center gap-2">
                  <Link
                    to={`/${p.slug}`}
                    className="tap-scale min-w-0 flex-1 truncate text-sm font-medium text-ink"
                  >
                    {p.name}
                  </Link>
                  <button
                    type="button"
                    aria-label={`Add ${p.name} to bag`}
                    onClick={() => addOne(p)}
                    disabled={addingSlug === p.slug || addedSlugs.has(p.slug)}
                    className="tap-scale flex size-6 shrink-0 items-center justify-center rounded-full border border-line-strong text-sm leading-none text-ink disabled:opacity-50"
                  >
                    {addedSlugs.has(p.slug) ? "✓" : "+"}
                  </button>
                </div>
              ))}
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => respond(true)}
                  disabled={busy}
                  className="tap-scale flex-1 rounded-sm bg-rose px-3 py-1.5 text-xs font-medium text-black disabled:opacity-50"
                >
                  Add set to bag
                </button>
                <button
                  type="button"
                  onClick={() => respond(false)}
                  disabled={busy}
                  className="tap-scale flex-1 rounded-sm border border-line-strong px-3 py-1.5 text-xs text-ink disabled:opacity-50"
                >
                  Something else
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-line p-3">
        {!inputDisabled && chips.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {chips.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => askAndClear(p)}
                className="tap-scale rounded-sm border border-line-strong px-2.5 py-1.5 text-xs text-ink"
              >
                {p}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                askAndClear(input);
              }
            }}
            type="text"
            disabled={inputDisabled}
            placeholder="Ask about a scent…"
            className="h-10 min-w-0 flex-1 rounded-sm border border-line bg-transparent px-3 text-sm text-ink placeholder:text-muted focus:border-line-strong focus:outline-none disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => askAndClear(input)}
            disabled={inputDisabled || !input.trim()}
            className="tap-scale rounded-sm bg-rose px-3 text-sm font-medium text-black disabled:opacity-50"
          >
            Send
          </button>
        </div>
        <Link
          to="/discovery"
          search={activeConversationId ? { c: activeConversationId } : undefined}
          className="tap-scale mt-2 block text-center text-xs text-muted hover:text-ink"
        >
          Open full chat →
        </Link>
      </div>
    </div>
  );
}
