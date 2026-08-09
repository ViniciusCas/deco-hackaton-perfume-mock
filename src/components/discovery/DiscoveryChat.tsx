import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import Button from "~/components/ui/Button";
import { useDiscoveryChat } from "~/agents/discovery/useDiscoveryChat";
import { PROMPTS, useDiscoveryConversation } from "~/agents/discovery/useDiscoveryConversation";

/**
 * Discovery-chat UI — the real Agent behind the same two-column visual
 * shell the earlier scripted mock used (chat panel + avatar + prompt chips
 * on the left, a "Recommended"/"Your set" sidebar on the right), per an
 * explicit decision to restore `/discovery` with that look rather than the
 * simpler single-column design built for the (now-reverted) `/fragrance`
 * default-chat plan.
 *
 * Real functional difference from the mock, unavoidable given how the
 * backend actually works: the mock let a shopper freely browse an
 * always-3-item "Recommended" list and hand-pick individual items into
 * their own set. The real Agent instead curates a specific set itself and
 * asks a single accept/reject on it (agent.ts's respondToRecommendation) —
 * there's no backend concept of "browse candidates, pick some yourself."
 * The sidebar keeps the old panel's look (label, VialThumb rows) but its
 * actions are accept/reject on the Agent's current recommendation, not
 * per-item toggles.
 */

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-accent font-display text-black"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {name.slice(0, 1)}
    </div>
  );
}

function VialThumb({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-sm bg-glass font-display text-xs text-ink"
      style={{ width: size * 0.7, height: size }}
    >
      {name.slice(0, 1)}
    </div>
  );
}

const LABEL_CLASS = "font-display text-2xs font-medium tracking-(--tracking-label) uppercase";

export default function DiscoveryChat() {
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
    ask,
    respond,
    addOne,
  } = useDiscoveryConversation(chat);
  const [input, setInput] = useState("");
  const [historyCollapsed, setHistoryCollapsed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }, [messages, busy]);

  async function askAndClear(text: string) {
    setInput("");
    await ask(text);
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 pt-[90px] pb-10 sm:px-8 sm:pt-[110px] sm:pb-14">
      <div className="mt-4 mb-8 flex flex-col gap-4 sm:mt-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className={`${LABEL_CLASS} mb-3 text-ink`}>Discovery</div>
          <h1 className="font-display text-4xl font-light text-ink sm:text-5xl">
            Find your signature
          </h1>
          <p className="mt-3 max-w-xl text-sm text-muted sm:text-base">
            Tell the assistant what you like, where you'll wear it and who it's for, and it'll
            narrow the real catalog down to a few worth trying.
          </p>
        </div>
      </div>

      <div
        className={`grid grid-cols-1 items-start gap-8 ${
          canShowHistory
            ? historyCollapsed
              ? "lg:grid-cols-[56px_1fr_380px]"
              : "lg:grid-cols-[220px_1fr_380px]"
            : "lg:grid-cols-[1fr_380px]"
        }`}
      >
        {canShowHistory && (
          <aside className="flex h-[600px] flex-col gap-3 rounded-lg border border-line bg-surface p-4">
            <div className={`flex items-center gap-2 ${historyCollapsed ? "flex-col" : ""}`}>
              <button
                type="button"
                onClick={() => setHistoryCollapsed((v) => !v)}
                aria-label={historyCollapsed ? "Expand chat history" : "Collapse chat history"}
                className="tap-scale flex size-8 shrink-0 items-center justify-center rounded-sm border border-line-strong text-ink"
              >
                {historyCollapsed ? "»" : "«"}
              </button>
              {!historyCollapsed && (
                <button
                  type="button"
                  onClick={newConversation}
                  className="tap-scale flex-1 rounded-sm bg-rose px-3 py-2 text-sm font-medium text-black"
                >
                  + New chat
                </button>
              )}
              {historyCollapsed && (
                <button
                  type="button"
                  onClick={newConversation}
                  aria-label="New chat"
                  className="tap-scale flex size-8 shrink-0 items-center justify-center rounded-sm bg-rose text-sm font-medium text-black"
                >
                  +
                </button>
              )}
            </div>
            {!historyCollapsed && (
              <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
                {conversations.length === 0 ? (
                  <p className="px-1 py-2 text-xs text-muted">No past conversations yet.</p>
                ) : (
                  conversations.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => switchConversation(c.id)}
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
          </aside>
        )}

        <section className="flex h-[600px] flex-col overflow-hidden rounded-lg border border-line bg-surface">
          <div className="flex items-center gap-3 border-b border-line px-6 py-4">
            <Avatar name="S" />
            <div className="flex-1">
              <div className="font-display text-sm font-medium text-ink">Scent assistant</div>
              <div className="text-xs text-muted">
                {connecting ? "Connecting…" : "Real recommendations from our catalog"}
              </div>
            </div>
          </div>

          <div ref={scrollRef} className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[78%] rounded-2xl px-5 py-4 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.speaker === "advisor"
                    ? "self-start rounded-tl-md bg-blush-deep text-ink"
                    : "self-end rounded-tr-md bg-accent text-black"
                }`}
              >
                {m.content}
              </div>
            ))}
            {busy && (
              <div className="flex gap-1.5 self-start rounded-2xl rounded-tl-md bg-blush-deep px-5 py-4">
                <span className="size-1.5 animate-pulse rounded-full bg-muted" />
                <span className="size-1.5 animate-pulse rounded-full bg-muted [animation-delay:0.2s]" />
                <span className="size-1.5 animate-pulse rounded-full bg-muted [animation-delay:0.4s]" />
              </div>
            )}
          </div>

          <div className="border-t border-line p-4">
            {(() => {
              // Static PROMPTS only before the shopper's first real message
              // — messages[0] is always the greeting once primed, so "no
              // conversation yet" is length <= 1, not 0. There's no agent
              // turn yet to source dynamic ones from at that point; every
              // turn after that uses the Agent's own suggested_replies
              // (schemas.ts), and the whole row disappears whenever the
              // input itself is disabled — no point offering a reply that
              // can't be sent.
              const inputDisabled = connecting || busy || !!acceptedSet;
              const chips = messages.length <= 1 ? PROMPTS : suggestedReplies;
              if (inputDisabled || chips.length === 0) return null;
              return (
                <div className="mb-3 flex flex-wrap gap-2">
                  {chips.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => askAndClear(p)}
                      className="tap-scale rounded-sm border border-line-strong px-3.5 py-2 text-sm text-ink"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              );
            })()}
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
                disabled={connecting || busy || !!acceptedSet}
                placeholder="Tell the assistant what you're looking for…"
                className="h-12 min-w-0 flex-1 rounded-sm border border-line bg-transparent px-4 text-sm text-ink placeholder:text-muted focus:border-line-strong focus:outline-none disabled:opacity-50"
              />
              <Button
                type="button"
                variant="solid"
                size="md"
                onClick={() => askAndClear(input)}
                disabled={connecting || busy || !!acceptedSet || !input.trim()}
              >
                Send
              </Button>
            </div>
          </div>
        </section>

        <aside className="flex flex-col gap-5">
          <div className="rounded-lg border border-line bg-surface p-6">
            <div className="mb-4 flex items-baseline justify-between">
              <span className={LABEL_CLASS}>Your set</span>
              <span className="text-sm text-muted">{acceptedSet?.length ?? 0} picked</span>
            </div>
            {acceptedSet ? (
              <div className="flex flex-col gap-2.5">
                {acceptedSet.map((c) => (
                  <Link
                    key={c.id}
                    to={`/${c.slug}`}
                    className="tap-scale flex items-center gap-3 rounded-sm bg-blush p-3"
                  >
                    <VialThumb name={c.name} />
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-sm font-medium text-ink">{c.name}</div>
                      <div className="text-xs text-muted">
                        {c.family} · ${c.price}
                      </div>
                    </div>
                    <span className={`${LABEL_CLASS} text-accent`}>View</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">Chat with the assistant to build your set.</p>
            )}
          </div>

          <div className="rounded-lg border border-line bg-surface p-6">
            <div className={`${LABEL_CLASS} mb-1 text-ink`}>Recommended</div>
            <p className="mb-4 text-xs text-muted">Updates as the conversation narrows down.</p>
            {recommendation ? (
              <div className="flex flex-col gap-3.5">
                {recommendation.products.map((c) => (
                  <div key={c.id} className="flex items-center gap-3">
                    <Link
                      to={`/${c.slug}`}
                      className="tap-scale flex min-w-0 flex-1 items-center gap-3"
                    >
                      <VialThumb name={c.name} size={48} />
                      <div className="min-w-0 flex-1">
                        <div className="font-display text-sm font-medium text-ink">{c.name}</div>
                        <div className="text-xs text-muted">{c.notes}</div>
                      </div>
                    </Link>
                    <button
                      type="button"
                      aria-label={`Add ${c.name} to bag`}
                      onClick={() => addOne(c)}
                      disabled={addingSlug === c.slug || addedSlugs.has(c.slug)}
                      className="tap-scale flex size-8 shrink-0 items-center justify-center rounded-full border border-line-strong text-lg leading-none text-ink disabled:opacity-50"
                    >
                      {addedSlugs.has(c.slug) ? "✓" : "+"}
                    </button>
                  </div>
                ))}
                <div className="mt-1.5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => respond(true)}
                    disabled={busy}
                    className="tap-scale flex-1 rounded-sm bg-rose px-3.5 py-2 text-sm font-medium text-black disabled:opacity-50"
                  >
                    Add set to bag
                  </button>
                  <button
                    type="button"
                    onClick={() => respond(false)}
                    disabled={busy}
                    className="tap-scale flex-1 rounded-sm border border-line-strong px-3.5 py-2 text-sm text-ink disabled:opacity-50"
                  >
                    Something else
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted">Nothing recommended yet.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
