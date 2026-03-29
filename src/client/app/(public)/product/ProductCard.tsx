"use client";
import React from "react";
import { Eye } from "lucide-react";
import { Product } from "@/app/types/productTypes";
import Image from "next/image";
import Link from "next/link";
import useTrackInteraction from "@/app/hooks/miscellaneous/useTrackInteraction";
import { useRouter } from "next/navigation";
import { generateProductPlaceholder } from "@/app/utils/placeholderImage";
import useFormatPrice from "@/app/hooks/ui/useFormatPrice";
import { getProductListingPriceSummary } from "@/app/lib/productPricing";
import { beginNavigationActivity } from "@/app/lib/activityIndicator";

interface ProductCardProps {
  product: Product;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { trackInteraction } = useTrackInteraction();
  const router = useRouter();
  const formatPrice = useFormatPrice();
  const productHref = `/product/${product.slug}`;

  const handleClick = () => {
    trackInteraction(product.id, "click");
    beginNavigationActivity();
    router.push(productHref);
  };

  const handleLinkClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    trackInteraction(product.id, "click");
    beginNavigationActivity();
  };

  const prefetchProductRoute = () => {
    router.prefetch(productHref);
  };

  const displayImage =
    product.thumbnail ||
    generateProductPlaceholder(product.name);
  const {
    retailPrice,
    dealerPrice,
    effectivePrice,
    maxPrice,
    hasPriceRange,
    shouldLabelAsFrom,
    hasRetailPriceRange,
    hasDealerPriceRange,
  } = getProductListingPriceSummary(product);
  const mobileBasePrice =
    dealerPrice !== null ? retailPrice : hasPriceRange ? maxPrice : null;
  const showMobileStrikePrice =
    mobileBasePrice !== null && mobileBasePrice > effectivePrice;
  const retailLabelPrefix =
    shouldLabelAsFrom || hasRetailPriceRange ? "Retail from:" : "Retail:";
  const dealerLabelPrefix =
    shouldLabelAsFrom || hasDealerPriceRange ? "Dealer from:" : "Dealer:";
  const primaryPriceLabel = shouldLabelAsFrom
    ? `From ${formatPrice(effectivePrice)}`
    : formatPrice(effectivePrice);

  return (
    <div
      className="group bg-white rounded-sm border border-gray-100 overflow-hidden
       relative h-full flex flex-col"
      onClick={handleClick}
      onMouseEnter={prefetchProductRoute}
      onTouchStart={prefetchProductRoute}
      onFocus={prefetchProductRoute}
    >
      {/* Image Container */}
      <div className="relative w-full h-48 sm:h-[170px]  bg-gray-50 flex items-center justify-center overflow-hidden">
        <Link
          href={productHref}
          className="block w-full h-full"
          onClick={handleLinkClick}
        >
          <Image
            src={
              displayImage
            }
            alt={product.name}
            width={240}
            height={240}
            className="object-contain mx-auto p-4"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1536px) 33vw, 20vw"
            onError={(e) => {
              e.currentTarget.src = generateProductPlaceholder(product.name);
            }}
          />
        </Link>

        {/* Product Flags */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {product.isNew && (
            <span className="text-white text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--color-success)' }}>
              NEW
            </span>
          )}
          {product.isFeatured && (
            <span className="text-white text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--color-secondary)' }}>
              FEATURED
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="absolute top-2 right-2 flex space-x-1 z-10">
          <Link href={productHref} onClick={handleLinkClick}>
            <div
              className="bg-white/90 backdrop-blur-sm rounded-full p-1.5 shadow-sm "
              aria-label="View product details"
            >
              <Eye size={14} className="text-gray-700" />
            </div>
          </Link>
        </div>

      </div>

      <div className="p-3 sm:p-4 lg:p-5 flex flex-col flex-grow">
        <Link
          href={productHref}
          className="block flex-grow"
          onClick={handleLinkClick}
        >
          <h3 className="font-semibold text-gray-900 text-sm sm:text-sm lg:text-base mb-2 line-clamp-2 leading-snug">
            {product.name}
          </h3>

          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="flex items-center space-x-2">
              <div className="flex flex-col gap-0.5">
                <div className="sm:hidden">
                  {showMobileStrikePrice ? (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500 line-through">
                        {shouldLabelAsFrom
                          ? `From ${formatPrice(mobileBasePrice)}`
                          : formatPrice(mobileBasePrice)}
                      </span>
                      <span className="text-sm text-gray-700">
                        {primaryPriceLabel}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-700">
                      {primaryPriceLabel}
                    </span>
                  )}
                </div>
                <div className="hidden sm:flex sm:flex-col sm:gap-0.5">
                  {dealerPrice !== null ? (
                    <>
                      <span className="text-xs sm:text-sm text-gray-500 line-through">
                        {retailLabelPrefix} {formatPrice(retailPrice)}
                      </span>
                      <span className="text-base sm:text-lg text-gray-700 font-semibold">
                        {dealerLabelPrefix} {formatPrice(dealerPrice)}
                      </span>
                    </>
                  ) : (
                    <span className="text-sm sm:text-base text-gray-700 font-medium">
                      {primaryPriceLabel}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Link>

        {/* Quick Actions */}
        <div className="mt-auto pt-2 sm:pt-3 border-t border-gray-100">
          <button
            className="w-full text-white py-2 sm:py-2.5 lg:py-3 rounded-sm font-medium text-xs sm:text-sm"
            style={{ backgroundColor: 'var(--color-primary)' }}
            onClick={(e) => {
              e.stopPropagation();
              handleClick();
            }}
          >
            View Details
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
