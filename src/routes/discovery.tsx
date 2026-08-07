import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import Button from "~/components/ui/Button";
import type { CatalogEntry } from "~/platform/catalog";
import { getCatalogServerFn } from "~/platform/catalog/catalog.actions";

export const Route = createFileRoute("/discovery")({
  component: DiscoveryPage,
  loader: () => getCatalogServerFn(),
});

const GREETING =
  "Hi, tell me where you'll be wearing this — a normal work day, a night out, something for a gift — and I'll narrow the catalog down to three worth trying.";

const PROMPTS = [
  "Something for evenings",
  "Fresh and office-friendly",
  "A gift for my sister",
  "I wear amber and vanilla",
];

interface ChatMessage {
  role: "assistant" | "user";
  text: string;
}

/**
 * Keyword-scored reply against the local catalog — a scripted mock, not a
 * real AI integration. No network call, no API key, nothing external:
 * matches words in the visitor's message against each fragrance's mood/
 * family/notes text and recommends the top 3 by overlap.
 */
function scoreReply(catalog: CatalogEntry[], input: string): { text: string; slugs: string[] } {
  const words = input
    .toLowerCase()
    .split(/[^a-zà-ÿ]+/)
    .filter((w) => w.length > 3);

  const scored = catalog.map((entry) => {
    const haystack = `${entry.mood} ${entry.family} ${entry.notes}`.toLowerCase();
    const score = words.reduce((n, w) => (haystack.includes(w) ? n + 1 : n), 0);
    return { entry, score };
  }).sort((a, b) => b.score - a.score);

  const anyMatch = scored[0]?.score > 0;
  const top = (
    anyMatch ? scored.slice(0, 3) : catalog.slice(0, 3).map((entry) => ({ entry, score: 0 }))
  ).map((s) => s.entry);

  const text = anyMatch
    ? `Based on that, I'd start with ${top.map((c) => c.name).join(", ")}. ${top[0].name} is our ${top[0].family.toLowerCase()} — ${top[0].notes.toLowerCase()}. Tell me which one appeals and I'll swap the other two.`
    : `I couldn't quite place that one — tell me a mood or occasion (evening, office, a gift, fresh, warm) and I'll narrow it down.`;

  return { text, slugs: top.map((c) => c.slug) };
}

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

function DiscoveryPage() {
  const catalog = Route.useLoaderData();
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", text: GREETING }]);
  const [recommended, setRecommended] = useState<string[]>(catalog.slice(0, 3).map((c) => c.slug));
  const [picks, setPicks] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const ask = (text: string) => {
    const clean = text.trim();
    if (!clean || busy) return;
    const history: ChatMessage[] = [...messages, { role: "user", text: clean }];
    setMessages(history);
    setBusy(true);
    setInput("");

    // Scripted local reply — deliberately delayed so it reads like a
    // response rather than a client-side keyword match; no network involved.
    window.setTimeout(() => {
      const reply = scoreReply(catalog, clean);
      setMessages((prev) => [...prev, { role: "assistant", text: reply.text }]);
      setRecommended(reply.slugs);
      setBusy(false);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      });
    }, 500);
  };

  const byslug = Object.fromEntries(catalog.map((c) => [c.slug, c]));
  const slots = [0, 1, 2].map((i) => byslug[picks[i]] ?? null);

  const addPick = (slug: string) => {
    if (picks.includes(slug) || picks.length >= 3) return;
    setPicks((p) => [...p, slug]);
  };
  const removePick = (slug: string) => setPicks((p) => p.filter((s) => s !== slug));

  return (
    <div className="mx-auto max-w-6xl px-4 pt-[90px] pb-10 sm:px-8 sm:pt-[110px] sm:pb-14">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className={`${LABEL_CLASS} mb-3 text-accent`}>Discovery sets</div>
          <h1 className="font-display text-4xl font-light text-ink sm:text-5xl">
            Build a set of three
          </h1>
          <p className="mt-3 max-w-xl text-sm text-muted sm:text-base">
            Tell the assistant what you like, where you'll wear it and who it's for — three vials,
            one chat.
          </p>
        </div>
        <div className="text-right">
          <div className="font-display text-4xl font-light text-ink">$24</div>
          <div className={`${LABEL_CLASS} mt-1 text-muted`}>Three vials · demo only</div>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_380px]">
        <section className="flex h-[600px] flex-col overflow-hidden rounded-lg border border-line bg-surface">
          <div className="flex items-center gap-3 border-b border-line px-6 py-4">
            <Avatar name="S" />
            <div className="flex-1">
              <div className="font-display text-sm font-medium text-ink">Scent assistant</div>
              <div className="text-xs text-muted">Scripted demo — not a live AI</div>
            </div>
            <span className={`${LABEL_CLASS} rounded-sm bg-glass-tag px-3 py-1.5 text-ink`}>
              Mock
            </span>
          </div>

          <div ref={scrollRef} className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[78%] rounded-2xl px-5 py-4 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === "assistant"
                    ? "self-start rounded-tl-md bg-blush-deep text-ink"
                    : "self-end rounded-tr-md bg-accent text-black"
                }`}
              >
                {m.text}
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
            <div className="mb-3 flex flex-wrap gap-2">
              {PROMPTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => ask(p)}
                  className="tap-scale rounded-sm border border-line-strong px-3.5 py-2 text-sm text-ink"
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    ask(input);
                  }
                }}
                type="text"
                placeholder="Tell the assistant what you're looking for…"
                className="h-12 min-w-0 flex-1 rounded-sm border border-line bg-transparent px-4 text-sm text-ink placeholder:text-muted focus:border-line-strong focus:outline-none"
              />
              <Button type="button" variant="solid" size="md" onClick={() => ask(input)}>
                Send
              </Button>
            </div>
          </div>
        </section>

        <aside className="flex flex-col gap-5">
          <div className="rounded-lg border border-line bg-surface p-6">
            <div className="mb-4 flex items-baseline justify-between">
              <span className={LABEL_CLASS}>Your set</span>
              <span className="text-sm text-muted">{picks.length} of 3</span>
            </div>
            <div className="mb-5 flex flex-col gap-2.5">
              {slots.map((c, i) =>
                c ? (
                  <div key={c.slug} className="flex items-center gap-3 rounded-sm bg-blush p-3">
                    <VialThumb name={c.name} />
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-sm font-medium text-ink">{c.name}</div>
                      <div className="text-xs text-muted">{c.family}</div>
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove ${c.name}`}
                      onClick={() => removePick(c.slug)}
                      className="text-muted hover:text-ink"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-sm border border-dashed border-line-strong p-3 text-sm text-muted"
                  >
                    <div className="h-10 w-7 rounded-sm bg-blush" />
                    Empty vial
                  </div>
                ),
              )}
            </div>
            <div className="mb-4 flex items-baseline justify-between">
              <span className="font-display text-lg text-ink">Set price</span>
              <span className="font-display text-2xl text-ink">$24.00</span>
            </div>
            <Button
              type="button"
              variant="solid"
              size="md"
              disabled={picks.length === 0}
              className="w-full"
            >
              Add set to bag
            </Button>
            <p className="mt-3 text-xs text-muted">Demo only — not wired to checkout.</p>
          </div>

          <div className="rounded-lg border border-line bg-surface p-6">
            <div className={`${LABEL_CLASS} mb-1 text-ink`}>Recommended</div>
            <p className="mb-4 text-xs text-muted">Updates from your last message.</p>
            <div className="flex flex-col gap-3.5">
              {recommended.map((slug) => {
                const c = byslug[slug];
                if (!c) return null;
                const added = picks.includes(slug);
                return (
                  <div key={slug} className="flex items-center gap-3">
                    <VialThumb name={c.name} size={48} />
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-sm font-medium text-ink">{c.name}</div>
                      <div className="text-xs text-muted">{c.notes}</div>
                    </div>
                    {added ? (
                      <span
                        className={`${LABEL_CLASS} rounded-sm bg-glass-tag px-3 py-1.5 text-ink`}
                      >
                        In set
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => addPick(slug)}
                        disabled={picks.length >= 3}
                        className={`${LABEL_CLASS} rounded-sm border border-line-strong px-3.5 py-1.5 text-ink disabled:opacity-40`}
                      >
                        Add
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
