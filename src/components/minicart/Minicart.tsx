import { formatPrice } from "@decocms/apps-commerce/sdk/formatPrice";
import { Link } from "@tanstack/react-router";
import { clx } from "~/sdk/clx";
import Icon from "../ui/Icon";
import Button from "../ui/Button";
import { MINICART_DRAWER_ID } from "../../constants";
import {
  useCart,
  useRemoveCartItem,
  useUpdateCartItem,
  type CartItem,
  type CartState,
} from "../../platform/cart";

function QuantityStepper({ item }: { item: CartItem }) {
  const update = useUpdateCartItem();
  const set = (quantity: number) =>
    update.mutate({ itemId: item.itemId, quantity: Math.max(1, quantity) });
  // No `pending` freeze: the quantity updates optimistically on click and the
  // "cart" mutation scope serializes the requests, so rapid clicks stay
  // consistent and the buttons remain interactive. Only the lower bound is
  // disabled.
  return (
    <div className="flex items-center overflow-hidden rounded-sm border border-line">
      <button
        type="button"
        aria-label="Decrease quantity"
        disabled={item.quantity <= 1}
        onClick={() => set(item.quantity - 1)}
        className="tap-scale flex size-7 items-center justify-center text-sm text-ink disabled:opacity-30"
      >
        −
      </button>
      <span className="min-w-6 text-center text-xs tabular-nums">{item.quantity}</span>
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={() => set(item.quantity + 1)}
        className="tap-scale flex size-7 items-center justify-center text-sm text-ink"
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
    <li
      className={clx(
        "flex gap-3 border-b border-line py-4 last:border-none",
        removing && "pointer-events-none opacity-50",
      )}
    >
      {item.image ? (
        <img
          className="size-16 rounded-sm border border-line object-cover"
          src={item.image}
          alt={item.title}
          referrerPolicy="no-referrer"
          loading="lazy"
        />
      ) : (
        <div className="size-16 rounded-sm bg-glass" aria-hidden="true" />
      )}
      <div className="flex grow flex-col gap-1">
        <a
          href={`/${item.slug}`}
          className="line-clamp-2 text-sm font-medium text-ink hover:underline"
        >
          {item.title}
        </a>
        <div className="text-sm text-muted">{formatPrice(item.price.amount, currency)}</div>
        <div className="mt-1 flex items-center justify-between">
          <QuantityStepper item={item} />
          <button
            type="button"
            aria-label="Remove item"
            disabled={removing}
            onClick={() => remove.mutate({ itemId: item.itemId })}
            className="tap-scale flex size-7 items-center justify-center text-muted hover:text-ink"
          >
            <Icon id="trash" size={16} />
          </button>
        </div>
      </div>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="flex grow flex-col items-center justify-center gap-6">
      <span className="font-display text-2xl font-light text-ink">Your bag is empty</span>
      <label
        htmlFor={MINICART_DRAWER_ID}
        className="tap-scale cursor-pointer rounded-sm border border-line-strong px-5 py-2.5 font-display text-2xs font-medium tracking-(--tracking-label) text-ink uppercase"
      >
        Choose products
      </label>
    </div>
  );
}

function closeMinicart() {
  const toggle = document.getElementById(MINICART_DRAWER_ID) as HTMLInputElement | null;
  if (toggle) toggle.checked = false;
}

function Footer({ cart }: { cart: CartState }) {
  return (
    <footer className="w-full border-t border-line">
      <div className="flex items-center justify-between px-4 py-4">
        <span className="text-sm text-muted">Subtotal</span>
        <span className="font-medium tabular-nums text-ink">
          {formatPrice(cart.subtotal.amount, cart.subtotal.currencyCode)}
        </span>
      </div>
      <div className="px-4 pb-3 text-right text-xs text-muted">
        Fees and shipping calculated at checkout
      </div>
      <div className="flex flex-col gap-2 p-4 pt-0">
        <Link
          to="/cart"
          preload="intent"
          onClick={closeMinicart}
          className="tap-scale flex h-10 items-center justify-center rounded-sm border border-line-strong font-display text-2xs font-medium tracking-(--tracking-label) text-ink uppercase"
        >
          View full bag
        </Link>
        <Button href="/checkout" variant="solid" size="md" onClick={closeMinicart}>
          Begin checkout
        </Button>
      </div>
    </footer>
  );
}

export default function Minicart() {
  const { cart, isFetching } = useCart();
  const currency = cart.subtotal.currencyCode;

  return (
    <div
      className={clx(
        "flex h-full w-full flex-col bg-surface",
        isFetching && "transition-opacity duration-150 opacity-80",
      )}
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="font-display text-xl font-normal text-ink">Your bag</h2>
        <label
          htmlFor={MINICART_DRAWER_ID}
          aria-label="Close cart"
          className="tap-scale flex size-9 cursor-pointer items-center justify-center rounded-sm text-ink hover:bg-glass"
        >
          <Icon id="close" size={18} />
        </label>
      </div>

      {cart.items.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <ul className="grow overflow-y-auto px-4">
            {cart.items.map((item) => (
              <CartLine key={item.itemId} item={item} currency={currency} />
            ))}
          </ul>
          <Footer cart={cart} />
        </>
      )}
    </div>
  );
}
