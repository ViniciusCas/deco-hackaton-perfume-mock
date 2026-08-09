import { useEffect, useRef, useState } from "react";
import { fetchProductVariants } from "~/platform/catalog/products.hooks";
import { useAddToCart } from "~/platform/cart";
import type { TurnResult } from "./agent";
import type { useDiscoveryChat } from "./useDiscoveryChat";

/**
 * The conversation engine shared by every discovery-chat surface — the
 * full `/discovery` page (DiscoveryChat.tsx) and the floating bubble
 * widget (DiscoveryBubble.tsx). Both need the same message list, turn
 * handling, and recommendation accept/reject/add-one behavior; only the
 * layout around it differs. Extracted from what used to be DiscoveryChat's
 * own state so a second surface didn't have to re-implement (and risk
 * drifting from) the same logic.
 */

export const GREETING =
  "Hi, I'm your scent assistant — think of me as a knowledgeable friend behind the counter. " +
  "Tell me who this is for and where they'll wear it — a normal work day, a night out, a " +
  "gift for someone special — and I'll find a few fragrances from our collection genuinely " +
  "worth trying, not just the bestsellers.";

export interface ChatMessage {
  speaker: "advisor" | "shopper";
  content: string;
}

export type RecommendationTurn = Extract<TurnResult, { kind: "recommendation" }>;
export type RecommendedProduct = RecommendationTurn["products"][number];

type DiscoveryChatHandle = ReturnType<typeof useDiscoveryChat>;

export function useDiscoveryConversation({
  agent,
  connecting,
  activeConversationId,
}: Pick<DiscoveryChatHandle, "agent" | "connecting" | "activeConversationId">) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [recommendation, setRecommendation] = useState<RecommendationTurn | null>(null);
  const [acceptedSet, setAcceptedSet] = useState<RecommendedProduct[] | null>(null);
  const [suggestedReplies, setSuggestedReplies] = useState<string[]>([]);
  const [addingSlug, setAddingSlug] = useState<string | null>(null);
  const [addedSlugs, setAddedSlugs] = useState<Set<string>>(new Set());
  // Whether this conversation already had turns in it the moment it was
  // loaded/switched to — captured once at priming time, not derived from
  // `messages.length` on every render, so it stays "existing" even once
  // it's true (a brand-new chat where the shopper has now said something)
  // and stays "new" for a truly fresh one even as it grows during this
  // session. Starts `false` (not yet known) until priming resolves.
  const [isExistingConversation, setIsExistingConversation] = useState(false);
  const primedFor = useRef<string | undefined>(undefined);
  const addToCart = useAddToCart();

  // Per-item "+" on a recommended product — resolves a default variant
  // (in-stock preferred, same fallback PDP uses) and adds it directly,
  // independent of the whole-set accept/reject flow below.
  async function addOne(product: RecommendedProduct) {
    if (addingSlug) return;
    setAddingSlug(product.slug);
    try {
      const variants = await fetchProductVariants(product.slug);
      const variantId = variants.find((v) => v.stock > 0)?.id ?? variants[0]?.id;
      if (!variantId) return;
      await addToCart.mutateAsync({ variantId });
      setAddedSlugs((prev) => new Set(prev).add(product.slug));
    } finally {
      setAddingSlug(null);
    }
  }

  // History backfill for a resumed (or switched-to) conversation. Keyed on
  // `activeConversationId` rather than firing once ever: switching
  // conversations changes the Agent connection's `name` (useDiscoveryChat.ts),
  // and this hook's own local state has to reset to match — otherwise the
  // previous conversation's messages/recommendation would linger under the
  // new one. `primedFor` (the id last primed, not a boolean) both dedupes
  // dev-mode StrictMode's double-invoke and detects a genuine conversation
  // switch.
  useEffect(() => {
    if (connecting || primedFor.current === activeConversationId) return;
    primedFor.current = activeConversationId;
    setMessages([]);
    setRecommendation(null);
    setAcceptedSet(null);
    setSuggestedReplies([]);
    setAddedSlugs(new Set());
    setIsExistingConversation(false);
    (async () => {
      await agent.ready;
      const history = await agent.call("getConversationHistory", []);
      setIsExistingConversation(history.length > 0);
      setMessages([{ speaker: "advisor", content: GREETING }, ...(history as ChatMessage[])]);

      // Restore the "Recommended"/"Your set" sidebar too, not just the
      // transcript — pendingRecommendationLabels/finalRecommendationLabels
      // were always persisted server-side (state.ts), so a reload or a
      // switch back to an older conversation shouldn't lose them.
      const { pending, accepted } = await agent.call("getRecommendationState", []);
      if (accepted) {
        setAcceptedSet(accepted);
      } else if (pending) {
        setRecommendation({
          kind: "recommendation",
          message: pending.message,
          forced: false,
          degraded: false,
          products: pending.products,
        });
      }
    })();
  }, [connecting, activeConversationId, agent]);

  function applyResult(result: TurnResult) {
    setMessages((prev) => [...prev, { speaker: "advisor", content: result.message }]);
    setRecommendation(result.kind === "recommendation" ? result : null);
    setSuggestedReplies(result.kind === "question" ? result.suggestedReplies : []);
  }

  async function ask(text: string) {
    const clean = text.trim();
    if (!clean || busy) return;
    setMessages((prev) => [...prev, { speaker: "shopper", content: clean }]);
    setBusy(true);
    try {
      const result = await agent.call("submitTurn", [clean]);
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
      setBusy(false);
    }
  }

  async function respond(accept: boolean) {
    if (busy || !recommendation) return;
    setBusy(true);
    try {
      const products = recommendation.products;
      const result = await agent.call("respondToRecommendation", [accept]);
      setRecommendation(null);
      if (result.kind === "accepted") {
        setAcceptedSet(products);
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
      setBusy(false);
    }
  }

  return {
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
  };
}
