"use client";

import React, { useEffect, useState } from "react";
import { Product } from "@/app/types/productTypes";
import ProductSection from "@/app/(public)/product/ProductSection";
import { useGetAllProductsQuery } from "@/app/store/apis/ProductApi";

interface HydratedProductSectionProps {
  title: string;
  initialProducts: Product[];
  initialProductsAreFallback?: boolean;
  filters: Record<string, unknown>;
  showTitle?: boolean;
}

const HydratedProductSection: React.FC<HydratedProductSectionProps> = ({
  title,
  initialProducts,
  initialProductsAreFallback = false,
  filters,
  showTitle = false,
}) => {
  const [products, setProducts] = useState<Product[]>(initialProducts);

  // Build query params from filters
  const queryParams: Record<string, string> = { limit: "12" };
  if (filters.isFeatured) queryParams.featured = "true";
  if (filters.isTrending) queryParams.isTrending = "true";
  if (filters.isNew) queryParams.isNew = "true";
  if (filters.isBestSeller) queryParams.bestselling = "true";

  const { data, isLoading, error } = useGetAllProductsQuery(queryParams, {
    // If SSR returned real data, skip the initial client fetch
    skip: !initialProductsAreFallback && initialProducts.length > 0,
  });

  useEffect(() => {
    const fresh = data?.products;
    if (Array.isArray(fresh) && fresh.length > 0) {
      setProducts(fresh);
    }
  }, [data]);

  const isInitialLoad = isLoading && products.length === 0;

  if (isInitialLoad) {
    return (
      <section className="py-8 sm:py-12 lg:py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-7 w-40 bg-gray-200 rounded animate-pulse mb-8" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl overflow-hidden shadow-sm">
                <div className="aspect-[3/4] bg-gray-200 animate-pulse" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <ProductSection
      title={title}
      products={products}
      loading={false}
      error={error as any}
      showTitle={showTitle}
    />
  );
};

export default HydratedProductSection;
