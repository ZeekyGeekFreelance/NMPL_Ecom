import ShopPageClient from "./ShopPageClient";
import {
  buildShopFiltersFromSearchParams,
  getShopRequestPageSize,
  normalizeShopServerFilters,
} from "./shopShared";
import type { ShopSearchParamsRecord } from "./shopShared";
import { fetchServerProductConnection } from "@/app/lib/serverProductQueries";

interface ShopPageProps {
  searchParams?: Promise<ShopSearchParamsRecord>;
}

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const resolvedSearchParams = await (searchParams ?? Promise.resolve({}));
  const initialFilters = buildShopFiltersFromSearchParams(resolvedSearchParams);
  const initialConnection = await fetchServerProductConnection({
    first: getShopRequestPageSize(initialFilters),
    skip: 0,
    filters: normalizeShopServerFilters(initialFilters),
  });

  return (
    <ShopPageClient
      initialFilters={initialFilters}
      initialConnection={initialConnection}
    />
  );
}
