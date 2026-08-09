import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createDecoRouter } from "@decocms/tanstack";
import { routeTree } from "./routeTree.gen";
import "./setup";

export function getRouter() {
  // Created fresh on every call, not hoisted to module scope: TanStack
  // Start calls getRouter() per-request on the server (via its own
  // AsyncLocalStorage context — see getRouterInstance in
  // @tanstack/start-client-core), so a module-level QueryClient here would
  // silently share cached data (user identity, cart, catalog) across
  // different visitors' concurrent requests within the same Worker isolate.
  // Client-side, getRouter() is only called once during hydration, so this
  // still yields exactly one long-lived QueryClient for the browser session.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 60_000 } },
  });

  return createDecoRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
    Wrap: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
