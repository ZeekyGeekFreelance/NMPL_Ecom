"use client";

import { useAddToCartMutation } from "@/app/store/apis/CartApi";
import { useAuth } from "@/app/hooks/useAuth";
import useToast from "@/app/hooks/ui/useToast";
import { Product } from "@/app/types/productTypes";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useFormatPrice from "@/app/hooks/ui/useFormatPrice";
import Link from "next/link";
import { isCustomerDisplayRole, resolveDisplayRole } from "@/app/lib/userRole";
import { setPendingAuthIntent } from "@/app/lib/authIntent";

interface ProductInfoProps {
  id: string;
  name: string;
  description: string;
  variants: Product["variants"];
  selectedVariant: Product["variants"][0] | null;
  onVariantChange: (attributeName: string, value: string) => void;
  attributeGroups: Record<string, { values: Set<string> }>;
  selectedAttributes: Record<string, string>;
}

const ProductInfo: React.FC<ProductInfoProps> = ({
  id,
  name,
  description,
  variants,
  selectedVariant,
  onVariantChange,
  attributeGroups,
  selectedAttributes,
}) => {
  const { showToast } = useToast();
  const { isAuthenticated, user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const formatPrice = useFormatPrice();
  const [addToCart, { isLoading }] = useAddToCartMutation();
  const displayRole = resolveDisplayRole(user);
  const isCustomerUser = isAuthenticated && isCustomerDisplayRole(displayRole);
  const isGuest = !isAuthenticated;
  const showDealerSignupNudge = !isAuthenticated || displayRole === "USER";

  const getCurrentPathWithSearch = () => {
    const query = searchParams?.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  const resolveSelectedVariantForCart = () => {
    if (!selectedVariant) {
      showToast("Please select a valid variant", "error");
      return null;
    }

    return selectedVariant;
  };

  const addSelectedVariantToCart = async (): Promise<boolean> => {
    const variant = resolveSelectedVariantForCart();
    if (!variant) {
      return false;
    }

    if (!isCustomerUser) {
      showToast("Cart is available only for customer accounts.", "error");
      return false;
    }

    try {
      await addToCart({
        variantId: variant.id,
        quantity: 1,
      }).unwrap();
      return true;
    } catch (error: any) {
      showToast(error.data?.message || "Failed to add to cart", "error");
      console.error("Error adding to cart:", error);
      return false;
    }
  };

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();

    if (isAuthLoading) {
      showToast("Checking session. Please try again in a moment.", "info");
      return;
    }

    const variant = resolveSelectedVariantForCart();
    if (!variant) {
      return;
    }

    if (isGuest) {
      const returnTo = getCurrentPathWithSearch();
      setPendingAuthIntent({
        actionType: "add_to_cart",
        productId: id,
        variantId: variant.id,
        quantity: 1,
        returnTo,
      });
      showToast("Please sign in to continue with your cart action.", "info");
      router.push(`/sign-in?next=${encodeURIComponent(returnTo)}`);
      return;
    }

    const isAdded = await addSelectedVariantToCart();
    if (!isAdded) {
      return;
    }

    showToast("Product added to cart", "success");
  };

  const handleBuyNow = async (e: React.MouseEvent) => {
    e.preventDefault();

    if (isAuthLoading) {
      showToast("Checking session. Please try again in a moment.", "info");
      return;
    }

    const variant = resolveSelectedVariantForCart();
    if (!variant) {
      return;
    }

    if (isGuest) {
      const returnTo = getCurrentPathWithSearch();
      setPendingAuthIntent({
        actionType: "buy_now",
        productId: id,
        variantId: variant.id,
        quantity: 1,
        returnTo,
      });
      showToast("Please sign in to continue with checkout.", "info");
      router.push(`/sign-in?next=${encodeURIComponent(returnTo)}`);
      return;
    }

    if (!isCustomerUser) {
      showToast("Cart is available only for customer accounts.", "error");
      return;
    }

    setPendingAuthIntent({
      actionType: "buy_now",
      productId: id,
      variantId: variant.id,
      quantity: 1,
      returnTo: "/cart",
    });

    router.push("/cart");
  };

  const effectivePrice = selectedVariant
    ? Number(selectedVariant.price ?? 0)
    : Number(variants[0]?.price ?? 0);
  const retailPrice = selectedVariant
    ? Number(selectedVariant.retailPrice ?? selectedVariant.price ?? 0)
    : Number(variants[0]?.retailPrice ?? variants[0]?.price ?? 0);
  const hasDealerSpecificPrice =
    Number.isFinite(effectivePrice) &&
    Number.isFinite(retailPrice) &&
    effectivePrice > 0 &&
    retailPrice > 0 &&
    effectivePrice !== retailPrice;
  const discountPercent = hasDealerSpecificPrice
    ? Math.max(0, Math.round(((retailPrice - effectivePrice) / retailPrice) * 100))
    : 0;
  const selectedSku = selectedVariant?.sku || variants[0]?.sku || "N/A";
  const cartActionAllowed = !!selectedVariant;
  const canUseCart = !isAuthLoading && cartActionAllowed && (isGuest || isCustomerUser);

  const colorValues = new Set<string>();
  const sizeValues = new Set<string>();
  variants.forEach((variant) => {
    variant.attributes.forEach(({ attribute, value }) => {
      if (attribute.name.toLowerCase() === "color") {
        colorValues.add(value.value);
      } else if (attribute.name.toLowerCase() === "size") {
        sizeValues.add(value.value);
      }
    });
  });

  const getColorValue = (colorName: string) => {
    const colorMap: Record<string, string> = {
      red: "#ef4444",
      blue: "#3b82f6",
      green: "#10b981",
      yellow: "#f59e0b",
      purple: "#8b5cf6",
      pink: "#ec4899",
      orange: "#f97316",
      brown: "#a16207",
      black: "#0f172a",
      white: "#ffffff",
      gray: "#6b7280",
      grey: "#6b7280",
      navy: "#1e3a8a",
      maroon: "#991b1b",
      teal: "#0d9488",
      lime: "#84cc16",
      indigo: "#6366f1",
      cyan: "#06b6d4",
      amber: "#f59e0b",
      emerald: "#10b981",
      rose: "#f43f5e",
      violet: "#8b5cf6",
      sky: "#0ea5e9",
      slate: "#64748b",
      zinc: "#71717a",
      neutral: "#737373",
      stone: "#78716c",
    };
    return colorMap[colorName.toLowerCase()] || "#6b7280";
  };

  const variantMatchesSelections = (
    variant: Product["variants"][0],
    selections: Record<string, string>
  ) =>
    Object.entries(selections).every(([attributeName, attributeValue]) =>
      variant.attributes.some(
        (attribute) =>
          attribute.attribute.name === attributeName &&
          attribute.value.value === attributeValue
      )
    );

  const isOptionAvailable = (attributeName: string, value: string) => {
    const intendedSelections = {
      ...selectedAttributes,
      [attributeName]: value,
    };

    return variants.some(
      (variant) => variantMatchesSelections(variant, intendedSelections)
    );
  };

  const getOptionDisplayPrice = (attributeName: string, value: string) => {
    const intendedSelections = {
      ...selectedAttributes,
      [attributeName]: value,
    };

    const matchedVariant =
      variants.find((variant) =>
        variantMatchesSelections(variant, intendedSelections)
      );

    if (!matchedVariant) {
      return null;
    }

    const optionPrice = Number(matchedVariant.price ?? 0);
    if (!Number.isFinite(optionPrice) || optionPrice <= 0) {
      return null;
    }

    return formatPrice(optionPrice);
  };

  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="space-y-6">
        <header className="border-b border-gray-200 pb-4">
          <h1 className="type-h2 text-slate-900">
            {name}
          </h1>
          <p className="mt-2 prose-section text-slate-500">{description}</p>
        </header>

        <section className="space-y-2 border-b border-gray-200 pb-5">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="price-display text-slate-900">
              {formatPrice(effectivePrice)}
            </span>
            {hasDealerSpecificPrice && (
              <>
                <span className="price-display-sm text-slate-500 line-through">
                  {formatPrice(retailPrice)}
                </span>
                {discountPercent > 0 && (
                  <span className="text-base sm:text-lg font-semibold text-amber-600">
                    ({discountPercent}% OFF)
                  </span>
                )}
              </>
            )}
          </div>
          <p className="text-sm font-medium text-emerald-700">inclusive of all taxes</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
            <span>SKU: {selectedSku}</span>
            {colorValues.size > 0 && (
              <>
                <span className="h-1 w-1 rounded-full bg-slate-300" />
                <span>{colorValues.size} colors</span>
              </>
            )}
            {sizeValues.size > 0 && (
              <>
                <span className="h-1 w-1 rounded-full bg-slate-300" />
                <span>{sizeValues.size} sizes</span>
              </>
            )}
          </div>
        </section>

        <section className="space-y-5">
          {Object.entries(attributeGroups).map(([attributeName, { values }]) => {
            const isColor = attributeName.toLowerCase() === "color";
            const isSize = attributeName.toLowerCase() === "size";
            const valuesArray = Array.from(values).sort((left, right) =>
              left.localeCompare(right, undefined, {
                numeric: true,
                sensitivity: "base",
              })
            );

            return (
              <div key={attributeName} className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-900">
                    {isSize ? "Select Size" : attributeName}
                  </p>
                  {selectedAttributes[attributeName] && (
                    <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
                      Selected: {selectedAttributes[attributeName]}
                    </span>
                  )}
                </div>

                {isColor ? (
                  <div className="flex flex-wrap gap-3">
                    {valuesArray.map((value) => {
                      const isSelected = selectedAttributes[attributeName] === value;
                      const isUnavailable = !isOptionAvailable(attributeName, value);
                      const colorValue = getColorValue(value);
                      const isWhite =
                        colorValue.toLowerCase() === "#ffffff" ||
                        colorValue.toLowerCase() === "#fff";

                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            if (!isUnavailable) {
                              onVariantChange(attributeName, value);
                            }
                          }}
                          disabled={isUnavailable}
                          className={`group relative flex min-w-[3.5rem] flex-col items-center gap-1 ${
                            isUnavailable
                              ? "cursor-not-allowed opacity-75"
                              : "cursor-pointer"
                          }`}
                        >
                          <span
                            className={`relative block h-9 w-9 rounded-full border transition ${
                              isSelected
                                ? "ring-2 ring-indigo-500 ring-offset-2"
                                : "border-slate-300 group-hover:border-slate-500"
                            }`}
                            style={{ backgroundColor: colorValue }}
                          >
                            {isWhite && (
                              <span className="absolute inset-0 rounded-full border border-slate-300" />
                            )}
                            {isUnavailable && (
                              <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
                                <span className="absolute left-1/2 top-1/2 h-px w-[72%] -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-slate-500/80" />
                              </span>
                            )}
                          </span>
                          <span
                            className={`text-xs font-medium tracking-[0.04em] ${
                              isSelected ? "text-slate-900" : "text-slate-600"
                            }`}
                          >
                            {value}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2.5">
                    {valuesArray.map((value) => {
                      const isSelected = selectedAttributes[attributeName] === value;
                      const isUnavailable = !isOptionAvailable(attributeName, value);
                      const optionPrice = isSize
                        ? getOptionDisplayPrice(attributeName, value)
                        : null;

                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            if (!isUnavailable) {
                              onVariantChange(attributeName, value);
                            }
                          }}
                          disabled={isUnavailable}
                          className={`relative min-w-[78px] rounded-full border px-4 py-2 text-center transition ${
                            isSelected
                              ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                              : isUnavailable
                              ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                              : "border-slate-300 bg-white text-slate-900 hover:border-slate-500"
                          }`}
                        >
                          <span className="block text-sm font-semibold leading-tight">{value}</span>
                          {optionPrice && (
                            <span
                              className={`mt-1 block text-xs font-medium leading-tight ${
                                isSelected ? "text-slate-200" : "text-slate-500"
                              }`}
                            >
                              {optionPrice}
                            </span>
                          )}
                          {isUnavailable && (
                            <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
                              <span className="absolute left-1/2 top-1/2 h-px w-[78%] -translate-x-1/2 -translate-y-1/2 -rotate-[20deg] bg-slate-400/85" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </section>

        <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
          <button
            type="button"
            disabled={!canUseCart || isLoading}
            onClick={handleAddToCart}
            className={`h-12 w-full rounded-md px-4 text-sm font-semibold uppercase tracking-[0.08em] transition ${
              isLoading || !canUseCart
                ? "cursor-not-allowed bg-slate-300 text-slate-500"
                : "text-white"
            }`}
            style={(!isLoading && canUseCart) ? { backgroundColor: 'var(--color-primary)' } : {}}
          >
            {isLoading
              ? "Adding..."
              : isAuthLoading
              ? "Checking..."
              : canUseCart
              ? "Add to Cart"
              : !isGuest && !isCustomerUser
              ? "Cart Unavailable"
              : "Select a Variant"}
          </button>
          <button
            type="button"
            disabled={!canUseCart || isLoading}
            onClick={handleBuyNow}
            className={`h-12 w-full rounded-md border px-4 text-sm font-semibold uppercase tracking-[0.08em] transition ${
              canUseCart && !isLoading
                ? "border-slate-300 bg-white text-slate-900 hover:border-slate-900"
                : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
            }`}
          >
            Buy Now
          </button>
        </div>

        {showDealerSignupNudge && (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <span className="font-medium">Are you a dealer?</span>{" "}
            <Link
              href="/dealer/register"
              className="font-medium"
              style={{ color: 'var(--color-secondary)' }}
            >
              Request dealer sign-up
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductInfo;
