import { createServerFn } from "@tanstack/react-start";
import { getCatalogEntries } from "~/db/queries";

/**
 * Kept only for discovery.tsx's local keyword-scoring mock, which needs the
 * full catalog client-side and was explicitly deferred from the
 * sillage-api catalog migration — see
 * .scratch/backend-api/issues/14-catalog-cutover-remaining.md. Every other
 * catalog consumer now goes through src/platform/catalog/products.hooks.ts
 * (sillage-api) instead.
 */
export const getCatalogServerFn = createServerFn({ method: "GET" }).handler(() =>
  getCatalogEntries(),
);
