import { createServerFn } from "@tanstack/react-start";
import {
  getCatalogEntries,
  getHomeCollections,
  getProductBySlug,
  getProductVariantsBySlug,
} from "~/db/queries";

export const getCatalogServerFn = createServerFn({ method: "GET" }).handler(() =>
  getCatalogEntries(),
);

export const getHomeCollectionsServerFn = createServerFn({ method: "GET" }).handler(() =>
  getHomeCollections(),
);

export const getProductBySlugServerFn = createServerFn({ method: "GET" })
  .inputValidator((slug: string) => slug)
  .handler(({ data: slug }) => getProductBySlug(slug));

export const getProductVariantsBySlugServerFn = createServerFn({ method: "GET" })
  .inputValidator((slug: string) => slug)
  .handler(({ data: slug }) => getProductVariantsBySlug(slug));
