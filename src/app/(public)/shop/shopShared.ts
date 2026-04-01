export type SortByOption =
  | "RELEVANCE"
  | "PRICE_ASC"
  | "PRICE_DESC"
  | "NAME_ASC";

export interface FilterValues {
  search: string;
  sortBy?: SortByOption;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  isNew?: boolean;
  isFeatured?: boolean;
  isTrending?: boolean;
  isBestSeller?: boolean;
}

export interface ShopProductFiltersInput {
  search?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  isNew?: boolean;
  isFeatured?: boolean;
  isTrending?: boolean;
  isBestSeller?: boolean;
}

export type ShopSearchParamsRecord = Record<
  string,
  string | string[] | undefined
>;

export const DEFAULT_SORT: SortByOption = "RELEVANCE";
export const BASE_PAGE_SIZE = 12;
export const SEARCH_PAGE_SIZE = 48;

const readFirstValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const toFiniteNumber = (value: string | null | undefined): number | undefined => {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const readBoolean = (value: string | undefined): boolean | undefined =>
  value === "true" ? true : undefined;

export const buildShopFiltersFromReader = (
  read: (key: string) => string | undefined
): FilterValues => ({
  search: read("search") || "",
  sortBy: (read("sortBy") as SortByOption | undefined) || DEFAULT_SORT,
  isNew: readBoolean(read("isNew")),
  isFeatured: readBoolean(read("isFeatured")),
  isTrending: readBoolean(read("isTrending")),
  isBestSeller: readBoolean(read("isBestSeller")),
  minPrice: toFiniteNumber(read("minPrice")),
  maxPrice: toFiniteNumber(read("maxPrice")),
  categoryId: read("categoryId") || undefined,
});

export const buildShopFiltersFromSearchParams = (
  searchParams: ShopSearchParamsRecord | undefined
): FilterValues =>
  buildShopFiltersFromReader((key) => readFirstValue(searchParams?.[key]));

export const normalizeShopServerFilters = (
  filters: FilterValues
): ShopProductFiltersInput => ({
  search: filters.search?.trim() || undefined,
  categoryId: filters.categoryId,
  minPrice: Number.isFinite(filters.minPrice) ? filters.minPrice : undefined,
  maxPrice: Number.isFinite(filters.maxPrice) ? filters.maxPrice : undefined,
  isNew: filters.isNew,
  isFeatured: filters.isFeatured,
  isTrending: filters.isTrending,
  isBestSeller: filters.isBestSeller,
});

export const getShopRequestPageSize = (filters: FilterValues): number =>
  filters.search?.trim() ? SEARCH_PAGE_SIZE : BASE_PAGE_SIZE;
