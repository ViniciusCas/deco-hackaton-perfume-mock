import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { formatPrice } from "@decocms/apps-commerce/sdk/formatPrice";
import Button from "~/components/ui/Button";
import Image from "~/components/ui/Image";
import { useCart } from "~/platform/cart";
import { useAddresses, type Address } from "~/platform/address";
import { useCheckout } from "~/platform/orders";
import type { Order } from "~/platform/orders";
import { useUser } from "~/platform/user";

export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
});

const LABEL_CLASS = "font-display text-2xs font-medium tracking-(--tracking-label) uppercase";
const INPUT_CLASS =
  "h-10 rounded-sm border border-line bg-surface px-3 text-sm text-ink placeholder:text-muted focus:border-line-strong focus:outline-none disabled:opacity-50";

const NEW_ADDRESS_VALUE = "__new__";

function addressLines(a: Address) {
  return [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode, a.addressCountry]
    .filter(Boolean)
    .join(", ");
}

function ShippingForm({
  addresses,
  selectedId,
  onSelect,
  newAddress,
  onNewAddressChange,
  disabled,
}: {
  addresses: Address[];
  selectedId: string;
  onSelect: (id: string) => void;
  newAddress: Record<string, string>;
  onNewAddressChange: (field: string, value: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      {addresses.map((a) => (
        <label
          key={a.id}
          className={`flex cursor-pointer items-start gap-3 rounded-sm border p-4 ${
            selectedId === a.id ? "border-ink" : "border-line"
          }`}
        >
          <input
            type="radio"
            name="address"
            checked={selectedId === a.id}
            onChange={() => onSelect(a.id)}
            disabled={disabled}
            className="mt-1 accent-rose"
          />
          <div className="text-sm">
            <div className="font-medium text-ink">{a.label || a.recipient || "Address"}</div>
            <div className="text-muted">{addressLines(a)}</div>
          </div>
        </label>
      ))}

      <label
        className={`flex cursor-pointer items-start gap-3 rounded-sm border p-4 ${
          selectedId === NEW_ADDRESS_VALUE ? "border-ink" : "border-line"
        }`}
      >
        <input
          type="radio"
          name="address"
          checked={selectedId === NEW_ADDRESS_VALUE}
          onChange={() => onSelect(NEW_ADDRESS_VALUE)}
          disabled={disabled}
          className="mt-1 accent-rose"
        />
        <span className="text-sm font-medium text-ink">Use a different address</span>
      </label>

      {selectedId === NEW_ADDRESS_VALUE && (
        <div className="grid grid-cols-2 gap-3 rounded-sm border border-line p-4">
          <input
            placeholder="Recipient"
            required
            disabled={disabled}
            value={newAddress.shippingRecipient ?? ""}
            onChange={(e) => onNewAddressChange("shippingRecipient", e.target.value)}
            className={`${INPUT_CLASS} col-span-2`}
          />
          <input
            placeholder="Street address"
            required
            disabled={disabled}
            value={newAddress.shippingStreetAddress ?? ""}
            onChange={(e) => onNewAddressChange("shippingStreetAddress", e.target.value)}
            className={`${INPUT_CLASS} col-span-2`}
          />
          <input
            placeholder="City"
            disabled={disabled}
            value={newAddress.shippingAddressLocality ?? ""}
            onChange={(e) => onNewAddressChange("shippingAddressLocality", e.target.value)}
            className={INPUT_CLASS}
          />
          <input
            placeholder="State/Region"
            disabled={disabled}
            value={newAddress.shippingAddressRegion ?? ""}
            onChange={(e) => onNewAddressChange("shippingAddressRegion", e.target.value)}
            className={INPUT_CLASS}
          />
          <input
            placeholder="Postal code"
            required
            disabled={disabled}
            value={newAddress.shippingPostalCode ?? ""}
            onChange={(e) => onNewAddressChange("shippingPostalCode", e.target.value)}
            className={INPUT_CLASS}
          />
          <input
            placeholder="Country"
            disabled={disabled}
            value={newAddress.shippingAddressCountry ?? ""}
            onChange={(e) => onNewAddressChange("shippingAddressCountry", e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
      )}
    </div>
  );
}

function OrderConfirmation({ order }: { order: Order }) {
  const currency = order.total.currencyCode;
  return (
    <div className="mx-auto max-w-2xl px-4 pt-[90px] pb-14 text-center sm:px-8 sm:pt-[110px]">
      <h1 className="mb-2 font-display text-3xl font-light text-ink">Order placed</h1>
      <p className="mb-8 text-sm text-muted">
        Order <span className="text-ink">{order.id}</span> — we'll send updates to your account.
      </p>

      <div className="rounded-lg border border-line bg-surface p-6 text-left">
        <ul className="flex flex-col gap-3">
          {order.items.map((item) => (
            <li key={item.variantId} className="flex justify-between text-sm">
              <span className="text-ink">
                {item.title} ({item.size}) × {item.quantity}
              </span>
              <span className="tabular-nums text-muted">
                {formatPrice(item.unitPrice.amount * item.quantity, currency)}
              </span>
            </li>
          ))}
        </ul>
        <div className="my-4 h-px bg-line" />
        <div className="flex items-baseline justify-between">
          <span className="font-display text-lg text-ink">Total</span>
          <span className="font-display text-xl tabular-nums text-ink">
            {formatPrice(order.total.amount, currency)}
          </span>
        </div>
      </div>

      <Button href="/" variant="solid" size="md" className="mt-8">
        Continue shopping
      </Button>
    </div>
  );
}

function CheckoutPage() {
  const { isAuthenticated, isLoading: userLoading } = useUser();
  const { cart, isLoading: cartLoading } = useCart();
  const { addresses, isLoading: addressesLoading } = useAddresses();
  const checkout = useCheckout();

  const [selectedId, setSelectedId] = useState<string>("");
  const [newAddress, setNewAddress] = useState<Record<string, string>>({});

  if (userLoading || cartLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center pt-[90px] sm:pt-[110px]">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4 pt-[90px] sm:pt-[110px]">
        <div className="frost w-full max-w-md rounded-lg p-8 text-center">
          <h1 className="mb-2 font-display text-2xl font-normal text-ink">Sign in to check out</h1>
          <p className="mb-6 text-sm text-muted">
            An account keeps your order history and addresses in one place.
          </p>
          <Button href="/login" variant="solid" size="md">
            Go to sign in
          </Button>
        </div>
      </div>
    );
  }

  if (checkout.isSuccess && checkout.data) {
    return <OrderConfirmation order={checkout.data} />;
  }

  if (cart.items.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 pt-[90px] sm:pt-[110px]">
        <span className="font-display text-2xl font-light text-ink">Your bag is empty</span>
        <Button href="/" variant="outline" size="md">
          Continue shopping
        </Button>
      </div>
    );
  }

  const effectiveSelectedId =
    selectedId || addresses.find((a) => a.isDefault)?.id || (addresses.length === 0 ? NEW_ADDRESS_VALUE : "");

  const canSubmit =
    effectiveSelectedId === NEW_ADDRESS_VALUE
      ? Boolean(
          newAddress.shippingRecipient &&
            newAddress.shippingStreetAddress &&
            newAddress.shippingPostalCode,
        )
      : Boolean(effectiveSelectedId);

  const onPlaceOrder = () => {
    if (effectiveSelectedId === NEW_ADDRESS_VALUE) {
      checkout.mutate(newAddress);
    } else {
      checkout.mutate({ addressId: effectiveSelectedId });
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 pt-[90px] pb-14 sm:px-8 sm:pt-[110px]">
      <h1 className="mb-8 font-display text-3xl font-light text-ink">Checkout</h1>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_360px]">
        <div>
          <div className={`${LABEL_CLASS} mb-4 text-ink`}>Shipping address</div>
          {addressesLoading ? (
            <span className="loading loading-spinner" />
          ) : (
            <ShippingForm
              addresses={addresses}
              selectedId={effectiveSelectedId}
              onSelect={setSelectedId}
              newAddress={newAddress}
              onNewAddressChange={(field, value) =>
                setNewAddress((prev) => ({ ...prev, [field]: value }))
              }
              disabled={checkout.isPending}
            />
          )}

          {checkout.isError && (
            <p className="mt-4 text-sm text-error">
              {checkout.error instanceof Error ? checkout.error.message : "Could not place order."}
            </p>
          )}
        </div>

        <aside className="h-fit rounded-lg border border-line bg-surface p-8">
          <div className={`${LABEL_CLASS} mb-6 text-ink`}>Order summary</div>
          <ul className="mb-4 flex flex-col gap-3">
            {cart.items.map((item) => (
              <li key={item.itemId} className="flex gap-3">
                {item.image ? (
                  <Image
                    src={item.image}
                    alt={item.title}
                    width={48}
                    height={48}
                    className="size-12 rounded-sm object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="size-12 rounded-sm bg-glass" aria-hidden="true" />
                )}
                <div className="flex-1 text-sm">
                  <div className="text-ink">{item.title}</div>
                  <div className="text-muted">
                    {item.size} × {item.quantity}
                  </div>
                </div>
                <span className="text-sm tabular-nums text-ink">
                  {formatPrice(item.price.amount * item.quantity, cart.subtotal.currencyCode)}
                </span>
              </li>
            ))}
          </ul>
          <div className="my-5 h-px bg-line" />
          <div className="mb-6 flex items-baseline justify-between">
            <span className="font-display text-xl text-ink">Total</span>
            <span className="font-display text-2xl tabular-nums text-ink">
              {formatPrice(cart.subtotal.amount, cart.subtotal.currencyCode)}
            </span>
          </div>
          <Button
            type="button"
            variant="solid"
            size="md"
            className="w-full"
            disabled={!canSubmit || checkout.isPending}
            onClick={onPlaceOrder}
          >
            {checkout.isPending ? <span className="loading loading-spinner loading-xs" /> : "Place order"}
          </Button>
        </aside>
      </div>
    </div>
  );
}
