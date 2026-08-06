import { useMutationState } from "@tanstack/react-query";
import { MINICART_DRAWER_ID } from "../../constants";
import { useCart } from "../../platform/cart";
import Icon from "../ui/Icon";

/**
 * Icon-only bag action with a small count badge — matches the design's
 * header, which renders search/account/bag as identical 44px icon buttons.
 */
export default function Bag() {
  const { cart } = useCart();
  const count = cart.items.length;
  // Global "cart busy" indicator: any in-flight cart mutation (add/update/
  // remove) from anywhere in the tree, read via useMutationState by the
  // ["cart", …] mutationKey — no prop drilling.
  const busy =
    useMutationState({
      filters: { mutationKey: ["cart"], status: "pending" },
    }).length > 0;

  return (
    <label
      htmlFor={MINICART_DRAWER_ID}
      aria-label="Open cart"
      className="tap-scale relative flex size-11 cursor-pointer items-center justify-center rounded-sm text-ink transition-colors duration-(--duration-fast) hover:bg-white/60"
    >
      {busy ? (
        <span className="loading loading-spinner loading-xs" />
      ) : (
        <Icon id="shopping_bag" size={19} />
      )}
      {!busy && count > 0 && (
        <span className="absolute top-1.5 right-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-rose px-0.5 text-[9px] leading-none font-medium tabular-nums text-black">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </label>
  );
}
