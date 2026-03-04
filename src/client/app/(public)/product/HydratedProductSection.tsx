"use client";

import React, { useEffect, useRef, useState } from "react";
import { useApolloClient, useQuery, NetworkStatus } from "@apollo/client";
import { GET_PRODUCTS } from "@/app/gql/Product";
import { Product } from "@/app/types/productTypes";
import ProductSection from "@/app/(public)/product/ProductSection";
import { useDealerCatalogPollInterval } from "@/app/hooks/network/useDealerCatalogPollInterval";

interface HydratedProductSectionProps {
  title: string;
  initialProducts: Product[];
  filters: Record<string, unknown>;
  showTitle?: boolean;
}

const HydratedProductSection: React.FC<HydratedProductSectionProps> = ({
  title,
  initialProducts,
  filters,
  showTitle = false,
}) => {
  const apolloClient = useApolloClient();
  const pollInterval = useDealerCatalogPollInterval();

  // Seed the Apollo cache with SSR data before the first render so that
  // useQuery("cache-first") finds it immediately and never fires a network
  // request on hydration.  We do this synchronously during render — before
  // any useEffect — so the cache is populated before Apollo evaluates the
  // query policy.
  const seededRef = useRef(false);
  if (!seededRef.current && initialProducts.length > 0) {
    try {
      apolloClient.writeQuery({
        query: GET_PRODUCTS,
        variables: { first: 12, skip: 0, filters },
        data: {
          products: {
            __typename: "ProductConnection",
            products: initialProducts,
            hasMore: false,
            totalCount: initialProducts.length,
          },
        },
      });
    } catch {
      // writeQuery can fail if the type policy isn't satisfied yet — safe to
      // ignore here because the useState fallback below still covers the render.
    }
    seededRef.current = true;
  }

  // Stable display state.  Initialised from SSR props and only ever updated
  // with real data — never regresses to empty on a background refresh failure.
  const [products, setProducts] = useState<Product[]>(initialProducts);

  const hasSSRData = initialProducts.length > 0;

  const { data, error, networkStatus } = useQuery(GET_PRODUCTS, {
    variables: { first: 12, skip: 0, filters },
    // cache-first: the seeded cache entry above will be served immediately,
    // no network request on mount.  Subsequent reads (e.g. after pollInterval
    // fires or the user navigates back) also hit the cache first.
    fetchPolicy: "cache-first",
    nextFetchPolicy: "cache-first",
    // Only report errors for the queries that actually go to the network.
    errorPolicy: "all",
    // Dealer catalog polling (approved dealers only — returns 0 for everyone
    // else so no unnecessary requests are made).
    pollInterval,
    notifyOnNetworkStatusChange: false,
    // If SSR gave us nothing and polling is off, still attempt one network
    // fetch so the section can self-populate without a page reload.
    skip: false,
  });

  // Promote fresh network data into display state but never regress to empty.
  useEffect(() => {
    const fresh = data?.products?.products;
    if (Array.isArray(fresh) && fresh.length > 0) {
      setProducts(fresh);
    }
  }, [data]);

  // An Apollo error is only surfaced to the user when:
  //   1. We have genuinely no data (SSR and client both returned nothing), AND
  //   2. The network actually reached the server (not just a cache miss).
  // If we already have products from SSR props or a previous successful fetch,
  // the error is silently swallowed — the user continues to see the last good
  // data while the background retry runs.
  const isRealNetworkError =
    networkStatus === NetworkStatus.error ||
    networkStatus === NetworkStatus.refetch;

  const displayError =
    error && products.length === 0 && isRealNetworkError ? error : undefined;

  // Show a skeleton while the very first network fetch is in-flight AND we
  // have no SSR data to show (edge case: SSR failed AND cache is cold).
  const isInitialLoad =
    networkStatus === NetworkStatus.loading && products.length === 0 && !hasSSRData;

  if (isInitialLoad) {
    // Thin inline skeleton — no separate component dependency.
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
      error={displayError}
      showTitle={showTitle}
    />
  );
};

export default HydratedProductSection;
