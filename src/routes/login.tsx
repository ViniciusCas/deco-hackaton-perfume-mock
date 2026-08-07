import { useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSignIn, useSignUp, useUser } from "../platform/user";
import Button from "../components/ui/Button";
import { clx } from "~/sdk/clx";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

type View = "signin" | "signup";

const LABEL_CLASS = "font-display text-2xs font-medium tracking-(--tracking-label) uppercase";
const INPUT_CLASS =
  "w-full h-11 rounded-sm border border-line bg-surface px-4 text-sm text-ink placeholder:text-muted focus:border-line-strong focus:outline-none disabled:opacity-50";

function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useUser();
  const [view, setView] = useState<View>("signin");

  const signIn = useSignIn();
  const signUp = useSignUp();

  if (isAuthenticated) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="frost w-full max-w-md rounded-lg p-8 text-center">
          <h1 className="mb-2 font-display text-2xl font-normal text-ink">You're signed in</h1>
          <p className="mb-6 text-sm text-muted">Head to your account dashboard to keep going.</p>
          <Button href="/account" variant="solid" size="md">
            Go to my account
          </Button>
        </div>
      </div>
    );
  }

  const onSignIn = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    signIn.mutate(
      {
        email: `${data.get("email") ?? ""}`.trim(),
        password: `${data.get("password") ?? ""}`,
      },
      { onSuccess: () => navigate({ to: "/account" }) },
    );
  };

  const onSignUp = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    signUp.mutate(
      {
        email: `${data.get("email") ?? ""}`.trim(),
        password: `${data.get("password") ?? ""}`,
        firstName: `${data.get("firstName") ?? ""}`.trim() || undefined,
        lastName: `${data.get("lastName") ?? ""}`.trim() || undefined,
      },
      { onSuccess: () => navigate({ to: "/account" }) },
    );
  };

  return (
    <div className="grid min-h-screen grid-cols-1 pt-[90px] sm:pt-[110px] lg:grid-cols-2">
      {/* Decorative panel — a gradient stand-in for campaign photography (no real
          asset available); mirrors the mockup's split-screen login layout. */}
      <div
        className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-end lg:p-13"
        style={{
          background:
            "linear-gradient(160deg, var(--color-violet) 0%, var(--color-violet-deep) 55%, var(--color-ink) 100%)",
        }}
      >
        <p className="max-w-sm font-display text-3xl font-light text-white">
          Keep your scent profile, refill history and saved samples in one place.
        </p>
      </div>

      <div className="flex flex-col justify-center px-6 py-16 sm:px-12 lg:px-20">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-9 flex gap-7">
            <button
              type="button"
              onClick={() => setView("signin")}
              className={clx(
                LABEL_CLASS,
                "border-b-2 pb-2.5",
                view === "signin" ? "border-accent text-ink" : "border-transparent text-muted",
              )}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setView("signup")}
              className={clx(
                LABEL_CLASS,
                "border-b-2 pb-2.5",
                view === "signup" ? "border-accent text-ink" : "border-transparent text-muted",
              )}
            >
              Create account
            </button>
          </div>

          {view === "signin" && (
            <form onSubmit={onSignIn} method="post" action="/login" className="flex flex-col gap-4">
              <h1 className="font-display text-3xl font-light text-ink">Welcome back</h1>
              <p className="-mt-2 text-sm text-muted">
                Sign in to manage your wishlist, orders and account details.
              </p>

              <label className="flex flex-col gap-2" htmlFor="signin-email">
                <span className={LABEL_CLASS}>Email</span>
                <input
                  id="signin-email"
                  type="email"
                  name="email"
                  required
                  autoComplete="username email"
                  className={INPUT_CLASS}
                  disabled={signIn.isPending}
                />
              </label>

              <label className="flex flex-col gap-2" htmlFor="signin-password">
                <span className={LABEL_CLASS}>Password</span>
                <input
                  id="signin-password"
                  type="password"
                  name="password"
                  required
                  autoComplete="current-password"
                  className={INPUT_CLASS}
                  disabled={signIn.isPending}
                />
              </label>

              {signIn.isError && (
                <p className="text-sm text-error">
                  {signIn.error instanceof Error ? signIn.error.message : "Sign-in failed."}
                </p>
              )}

              <Button type="submit" variant="solid" size="md" disabled={signIn.isPending}>
                {signIn.isPending ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>
          )}

          {view === "signup" && (
            <form onSubmit={onSignUp} method="post" action="/login" className="flex flex-col gap-4">
              <h1 className="font-display text-3xl font-light text-ink">Create account</h1>
              <p className="-mt-2 text-sm text-muted">It only takes a minute.</p>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-2" htmlFor="signup-firstname">
                  <span className={LABEL_CLASS}>First name</span>
                  <input
                    id="signup-firstname"
                    type="text"
                    name="firstName"
                    autoComplete="given-name"
                    className={INPUT_CLASS}
                    disabled={signUp.isPending}
                  />
                </label>
                <label className="flex flex-col gap-2" htmlFor="signup-lastname">
                  <span className={LABEL_CLASS}>Last name</span>
                  <input
                    id="signup-lastname"
                    type="text"
                    name="lastName"
                    autoComplete="family-name"
                    className={INPUT_CLASS}
                    disabled={signUp.isPending}
                  />
                </label>
              </div>

              <label className="flex flex-col gap-2" htmlFor="signup-email">
                <span className={LABEL_CLASS}>Email</span>
                <input
                  id="signup-email"
                  type="email"
                  name="email"
                  required
                  autoComplete="username email"
                  className={INPUT_CLASS}
                  disabled={signUp.isPending}
                />
              </label>

              <label className="flex flex-col gap-2" htmlFor="signup-password">
                <span className={LABEL_CLASS}>Password</span>
                <input
                  id="signup-password"
                  type="password"
                  name="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className={INPUT_CLASS}
                  disabled={signUp.isPending}
                />
              </label>

              {signUp.isError && (
                <p className="text-sm text-error">
                  {signUp.error instanceof Error
                    ? signUp.error.message
                    : "Could not create account."}
                </p>
              )}

              <Button type="submit" variant="solid" size="md" disabled={signUp.isPending}>
                {signUp.isPending ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  "Create account"
                )}
              </Button>
            </form>
          )}

          <p className="mt-8 text-center text-sm text-muted">
            <Link to="/" preload="intent" className="hover:text-ink">
              ← Back to home
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
