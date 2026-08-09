import { Link } from "@tanstack/react-router";
import Icon from "../ui/Icon";

const ICON_CLASS =
  "tap-scale flex size-11 items-center justify-center rounded-sm text-ink transition-colors duration-(--duration-fast) hover:bg-white/60";

/**
 * Desktop header wishlist entry point — previously only reachable via the
 * mobile menu, leaving desktop visitors with no way to find /wishlist at all.
 */
function WishlistLink() {
  return (
    <Link to="/wishlist" aria-label="Wishlist" preload="intent" className={ICON_CLASS}>
      <Icon id="favorite" size={19} />
    </Link>
  );
}

export default WishlistLink;
