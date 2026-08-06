import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSignOut, useUser } from "../platform/user";
import AddressBook from "../components/account/AddressBook";
import Button from "../components/ui/Button";

export const Route = createFileRoute("/account")({
  component: AccountPage,
});

function AccountPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading } = useUser();
  const signOut = useSignOut();

  if (isLoading) {
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
          <h1 className="mb-2 font-display text-2xl font-normal text-ink">You're not signed in</h1>
          <p className="mb-6 text-sm text-muted">Sign in to view your account details.</p>
          <Button href="/login" variant="solid" size="md">
            Go to sign in
          </Button>
        </div>
      </div>
    );
  }

  const initials =
    [user?.givenName?.[0], user?.familyName?.[0]].filter(Boolean).join("").toUpperCase() || "?";

  return (
    <div className="mx-auto max-w-4xl px-4 pt-[90px] pb-14 sm:px-8 sm:pt-[110px]">
      <div className="mb-10 flex items-center gap-4">
        <div className="flex size-13 shrink-0 items-center justify-center rounded-full bg-accent font-display text-lg text-white">
          {initials}
        </div>
        <div>
          <h1 className="font-display text-3xl font-light text-ink">
            {user?.givenName ? `Welcome back, ${user.givenName}` : "My account"}
          </h1>
          <p className="text-sm text-muted">{user?.email ?? ""}</p>
        </div>
      </div>

      <div className="frost max-w-xl rounded-lg p-6">
        <h2 className="mb-4 font-display text-2xs font-medium tracking-(--tracking-label) text-ink uppercase">
          Profile
        </h2>
        <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-sm">
          <dt className="text-muted">Name</dt>
          <dd className="text-ink">
            {[user?.givenName, user?.familyName].filter(Boolean).join(" ") || "—"}
          </dd>
          <dt className="text-muted">Email</dt>
          <dd className="text-ink">{user?.email ?? "—"}</dd>
        </dl>

        <div className="mt-6">
          <Button
            variant="outline"
            size="md"
            disabled={signOut.isPending}
            onClick={() =>
              signOut.mutate(undefined, {
                onSuccess: () => navigate({ to: "/" }),
              })
            }
          >
            {signOut.isPending ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              "Sign out"
            )}
          </Button>
        </div>
      </div>

      <AddressBook />
    </div>
  );
}
