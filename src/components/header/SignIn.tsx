import { Link } from "@tanstack/react-router";
import { useUser } from "../../platform/user";
import Icon from "../ui/Icon";

const ICON_CLASS =
  "tap-scale flex size-11 items-center justify-center rounded-sm text-ink transition-colors duration-(--duration-fast) hover:bg-white/60";

/**
 * Icon-only account action — matches the design's header, which renders
 * search/account/bag as identical 44px icon buttons (no text pill).
 */
function SignIn() {
  const { isAuthenticated } = useUser();
  const href = isAuthenticated ? "/account" : "/login";
  const label = isAuthenticated ? "Account" : "Sign in";

  return (
    <Link to={href} aria-label={label} preload="intent" className={ICON_CLASS}>
      <Icon id="account_circle" size={19} />
    </Link>
  );
}

export default SignIn;
