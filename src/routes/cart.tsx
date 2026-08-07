import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { formatPrice } from "@decocms/apps-commerce/sdk/formatPrice";
import Icon from "~/components/ui/Icon";
import Button from "~/components/ui/Button";
import { useCart, useRemoveCartItem, useUpdateCartItem, type CartItem } from "~/platform/cart";

export const Route = createFileRoute("/cart")({
  component: CartPage,
});

const LABEL_CLASS = "font-display text-2xs font-medium tracking-(--tracking-label) uppercase";

function QuantityStepper({ item }: { item: CartItem }) {
  const update = useUpdateCartItem();
  const set = (quantity: number) =>
    update.mutate({ itemId: item.itemId, quantity: Math.max(1, quantity) });
  return (
    <div className="flex items-center overflow-hidden rounded-sm border border-line">
      <button
        type="button"
        aria-label="Decrease quantity"
        disabled={item.quantity <= 1}
        onClick={() => set(item.quantity - 1)}
        className="tap-scale flex size-10 items-center justify-center text-lg leading-none text-ink disabled:opacity-30"
      >
        −
      </button>
      <span className="min-w-8 text-center text-sm tabular-nums">{item.quantity}</span>
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={() => set(item.quantity + 1)}
        className="tap-scale flex size-10 items-center justify-center text-lg leading-none text-ink"
      >
        +
      </button>
    </div>
  );
}

function CartLine({ item, currency }: { item: CartItem; currency: string }) {
  const remove = useRemoveCartItem();
  const removing = remove.isPending && remove.variables?.itemId === item.itemId;

  return (
    <div
      className={`grid grid-cols-[96px_1fr_auto] gap-4 border-b border-line py-6 sm:grid-cols-[132px_1fr_auto] sm:gap-6 ${
        removing ? "pointer-events-none opacity-50" : ""
      }`}
    >
      <div className="h-32 overflow-hidden rounded-md bg-surface sm:h-40">
        {item.image ? (
          <img
            src={item.image}
            alt={item.title}
            referrerPolicy="no-referrer"
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <div className="size-full bg-glass" aria-hidden="true" />
        )}
      </div>

      <div className="flex flex-col pt-1">
        <a href={`/${item.slug}`} className="font-display text-lg text-ink hover:underline">
          {item.title}
        </a>
        <div className="mt-1 text-sm text-muted">{formatPrice(item.price.amount, currency)}</div>
        <div className="mt-5 flex items-center gap-4">
          <QuantityStepper item={item} />
          <button
            type="button"
            aria-label="Remove item"
            disabled={removing}
            onClick={() => remove.mutate({ itemId: item.itemId })}
            className={`${LABEL_CLASS} text-muted hover:text-ink`}
          >
            Remove
          </button>
        </div>
      </div>

      <div className="pt-1 text-right">
        <div className="text-base font-semibold tabular-nums text-ink">
          {formatPrice(item.price.amount * item.quantity, currency)}
        </div>
      </div>
    </div>
  );
}

/**
 * "Free samples" have no backing data model in the commerce platform — this
 * repo's cart is line-item quantity only. Kept as local, non-persisted UI
 * state so the mockup's layout is representable without inventing a fake
 * checkout side-effect.
 */
function FreeSamplesMock() {
  const SAMPLE_NAMES = ["Neroli 07", "Figuier", "Ambre Doux", "Rose Cendre", "Bois Lacté"];
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (name: string) =>
    setPicked((prev) =>
      prev.includes(name)
        ? prev.filter((p) => p !== name)
        : prev.length < 2
          ? [...prev, name]
          : prev,
    );

  return (
    <div
      className="mt-8 rounded-lg p-6"
      style={{ backgroundColor: "color-mix(in srgb, var(--color-gold) 45%, transparent)" }}
    >
      <div className="mb-1 flex items-baseline justify-between">
        <span className={LABEL_CLASS}>Your two free samples</span>
        <span className="text-sm text-muted">{picked.length} of 2 chosen</span>
      </div>
      <p className="mb-4 text-sm text-muted">Pick any two 2ml vials to try alongside your order.</p>
      <div className="flex flex-wrap gap-2">
        {SAMPLE_NAMES.map((name) => {
          const on = picked.includes(name);
          return (
            <button
              key={name}
              type="button"
              onClick={() => toggle(name)}
              className={`${LABEL_CLASS} rounded-sm border px-4 py-2.5 ${
                on
                  ? "border-accent bg-accent text-black"
                  : "border-line-strong bg-transparent text-ink"
              }`}
            >
              {name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-24">
      <span className="font-display text-3xl font-light text-ink">Your bag is empty</span>
      <Button href="/" variant="outline" size="md">
        Continue shopping
      </Button>
    </div>
  );
}

function CartPage() {
  const { cart, isFetching } = useCart();
  const currency = cart.subtotal.currencyCode;
  // Promo code + gift note are UI-only mocks — no checkout endpoint accepts
  // them in this app; nothing here is submitted anywhere.
  const [promo, setPromo] = useState("");
  const [gift, setGift] = useState(false);

  return (
    <div
      className={`mx-auto max-w-6xl px-4 pt-[90px] pb-10 sm:px-8 sm:pt-[110px] sm:pb-14 ${isFetching ? "opacity-80" : ""}`}
    >
      <div className="mb-8 flex items-baseline gap-4">
        <h1 className="font-display text-4xl font-light text-ink">Your bag</h1>
        <span className={`${LABEL_CLASS} text-muted`}>
          {cart.totalQuantity} {cart.totalQuantity === 1 ? "item" : "items"}
        </span>
      </div>

      {cart.items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[1fr_360px] lg:gap-14">
          <div>
            <div className="border-t border-line">
              {cart.items.map((item) => (
                <CartLine key={item.itemId} item={item} currency={currency} />
              ))}
            </div>

            <FreeSamplesMock />

            <div className="mt-6 flex items-start gap-3 rounded-lg bg-surface p-6">
              <input
                type="checkbox"
                id="giftnote"
                checked={gift}
                onChange={(e) => setGift(e.target.checked)}
                className="mt-0.5 size-4 accent-rose"
              />
              <div className="flex-1">
                <label htmlFor="giftnote" className={`${LABEL_CLASS} cursor-pointer text-ink`}>
                  This is a gift
                </label>
                <p className="mt-1.5 text-sm text-muted">
                  We'll wrap it in tissue and leave prices off the packing slip.
                </p>
              </div>
            </div>

            <Link
              to="/"
              preload="intent"
              className="mt-7 inline-flex items-center gap-2 text-sm text-accent hover:text-rose-deep"
            >
              <Icon id="chevron-right" className="rotate-180" size={14} />
              Continue shopping
            </Link>
          </div>

          <aside className="rounded-lg border border-line bg-surface p-8">
            <div className={`${LABEL_CLASS} mb-6 text-ink`}>Order summary</div>
            <div className="mb-3 flex justify-between text-sm">
              <span className="text-muted">Subtotal</span>
              <span className="tabular-nums text-ink">
                {formatPrice(cart.subtotal.amount, currency)}
              </span>
            </div>
            <div className="mb-3 flex justify-between text-sm">
              <span className="text-muted">Shipping</span>
              <span className="text-ink">Calculated at checkout</span>
            </div>
            <div className="my-5 h-px bg-line" />
            <div className="mb-1 flex items-baseline justify-between">
              <span className="font-display text-xl text-ink">Total</span>
              <span className="font-display text-2xl tabular-nums text-ink">
                {formatPrice(cart.subtotal.amount, currency)}
              </span>
            </div>
            <p className="mb-6 text-xs text-muted">Taxes and fees calculated at checkout.</p>

            <Button href="/checkout" variant="solid" size="md" className="w-full">
              Checkout
            </Button>

            <div className="mt-5 flex gap-2">
              <input
                type="text"
                value={promo}
                onChange={(e) => setPromo(e.target.value)}
                placeholder="Promo code"
                className="h-11 min-w-0 flex-1 rounded-sm border border-line bg-transparent px-3 text-sm text-ink placeholder:text-muted focus:border-line-strong focus:outline-none"
              />
              <Button type="button" variant="outline" size="md" disabled={!promo.trim()}>
                Apply
              </Button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
