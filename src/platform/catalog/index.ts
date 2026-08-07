export type { CatalogEntry, ProductVariant } from "./catalog.types";
// getCatalogServerFn is discovery.tsx's own direct import from
// ./catalog.actions, not re-exported here — every other catalog consumer
// goes through ./products.hooks (sillage-api) instead. See
// .scratch/backend-api/issues/14-catalog-cutover-remaining.md.
