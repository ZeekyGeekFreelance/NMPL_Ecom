import { Product } from "@/app/types/productTypes";

type ProductPriceLike = Pick<
  Product,
  | "minPrice"
  | "maxPrice"
  | "dealerMinPrice"
  | "dealerMaxPrice"
  | "price"
  | "variants"
>;

const PRICE_EPSILON = 0.0001;

const toPositiveFiniteNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const getPositiveMinimum = (values: Array<unknown>): number | null => {
  const normalized = values
    .map((value) => toPositiveFiniteNumber(value))
    .filter((value): value is number => value !== null);

  if (normalized.length === 0) {
    return null;
  }

  return Math.min(...normalized);
};

const getPositiveMaximum = (values: Array<unknown>): number | null => {
  const normalized = values
    .map((value) => toPositiveFiniteNumber(value))
    .filter((value): value is number => value !== null);

  if (normalized.length === 0) {
    return null;
  }

  return Math.max(...normalized);
};

export const getProductListingPriceSummary = (product: ProductPriceLike) => {
  const variantRetailMinimum = getPositiveMinimum(
    (product.variants || []).map((variant) => variant.retailPrice ?? variant.price)
  );
  const variantRetailMaximum = getPositiveMaximum(
    (product.variants || []).map((variant) => variant.retailPrice ?? variant.price)
  );
  const variantEffectiveMinimum = getPositiveMinimum(
    (product.variants || []).map((variant) => variant.price)
  );
  const variantEffectiveMaximum = getPositiveMaximum(
    (product.variants || []).map((variant) => variant.price)
  );

  const retailPrice =
    toPositiveFiniteNumber(product.minPrice) ??
    toPositiveFiniteNumber(product.price) ??
    variantRetailMinimum ??
    variantEffectiveMinimum ??
    0;
  const retailMaxPrice =
    toPositiveFiniteNumber(product.maxPrice) ??
    variantRetailMaximum ??
    variantEffectiveMaximum;

  const rawDealerPrice =
    toPositiveFiniteNumber(product.dealerMinPrice) ?? variantEffectiveMinimum;
  const rawDealerMaxPrice =
    toPositiveFiniteNumber(product.dealerMaxPrice) ??
    variantEffectiveMaximum ??
    rawDealerPrice;
  const dealerPrice =
    rawDealerPrice !== null && Math.abs(rawDealerPrice - retailPrice) > PRICE_EPSILON
      ? rawDealerPrice
      : null;
  const dealerMaxPrice = dealerPrice !== null ? rawDealerMaxPrice : null;

  const effectivePrice = dealerPrice ?? retailPrice;
  const maxPrice =
    dealerMaxPrice ?? retailMaxPrice ?? variantEffectiveMaximum;
  const hasRetailPriceRange =
    retailMaxPrice !== null && retailMaxPrice - retailPrice > PRICE_EPSILON;
  const hasDealerPriceRange =
    dealerPrice !== null &&
    dealerMaxPrice !== null &&
    dealerMaxPrice - dealerPrice > PRICE_EPSILON;
  const hasPriceRange =
    maxPrice !== null && maxPrice - effectivePrice > PRICE_EPSILON;
  const shouldLabelAsFrom =
    hasPriceRange || hasRetailPriceRange || hasDealerPriceRange;

  return {
    retailPrice,
    retailMaxPrice,
    dealerPrice,
    dealerMaxPrice,
    effectivePrice,
    maxPrice,
    hasDealerPrice: dealerPrice !== null,
    hasPriceRange,
    hasRetailPriceRange,
    hasDealerPriceRange,
    shouldLabelAsFrom,
  };
};
