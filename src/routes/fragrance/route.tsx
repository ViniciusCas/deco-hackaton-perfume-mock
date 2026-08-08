import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * Pathless layout for the `/fragrance` directory — required so the router's
 * codegen has a real parent route to attach `browse.tsx` to instead of a
 * dangling reference. Deliberately has no loader: the flag-check redirect
 * lives in `index.tsx` alone, so it never runs for `/fragrance/browse`
 * (a sibling route needs to reach it without bouncing back to itself).
 */
export const Route = createFileRoute("/fragrance")({
  component: Outlet,
});
