"use client";

import React, { useEffect, useRef, useState } from "react";
import { useApolloClient, useQuery, NetworkStatus } from "@apollo/client";
import { GET_PRODUCTS } from "@/app/gql/Product";
import { Product } from "@/app/types/productTypes";
import ProductSection from "@/app/(public)/product/ProductSection";
import { useDealerCatalogPollInterval } from "@/app/hooks/network/useDealerCatalogPollInterval";
import { useAuth } from "@/app/hooks/useAuth";
import { useBackendReady } from "@/app/hooks/network/useBackendReady";

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
  const { user, isLoading: isAuthLoading } = useAuth();
  const backendReady = useBackendReady();
  const refreshedUserIdRef = useRef<string | null>(null);

  // Seed the Apollo cache with SSR data (or empty data) before the first render
  // so that useQuery("cache-first") finds an entry immediately and never fires
  // a cold-cache network request on hydration.
  //
  // Previously this guard was `initialProducts.length > 0`, which meant sections
  // with no flagged products in the DB would skip seeding, leave the cache cold,
  // trigger a network request, and surface "Failed to fetch" error banners.
  // Seeding with empty data is always safe: the cache entry is replaced by the
  // first successful auth-refetch or poll that returns real products.
  //
  // seededRef.current is only set to true on success so a writeQuery failure
  // (e.g. type policy not yet satisfied on first SSR render pass) is retried
  // on the next render rather than silently abandoned.
  const seededRef = useRef(false);
  if (!seededRef.current) {
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
      seededRef.current = true;
    } catch {
      // writeQuery can fail if the type policy isn't satisfied yet on the
      // first SSR render pass — safe to ignore, will be retried next render.
    }
  }

  // Stable display state — initialised from SSR props and only ever promoted
  // forward with real data; never regresses to empty on a background failure.
  const [products, setProducts] = useState<Product[]>(initialProducts);

  // Track whether we ever successfully loaded products for this section.
  // Used to decide whether a subsequent network error is worth surfacing:
  // if the section was always empty (no flagged products in the DB), a
  // downstream error panel is misleading — show an empty section instead.
  const hasEverLoadedRef = useRef(initialProducts.length > 0);

  const { data, error, networkStatus, refetch } = useQuery(GET_PRODUCTS, {
    variables: { first: 12, skip: 0, filters },
    // cache-first: the seeded cache entry above is served immediately on mount
    // (no network request). Subsequent reads (poll, navigate-back) also hit
    // cache first. A real network request only fires on refetch() or poll.
    fetchPolicy: "cache-first",
    nextFetchPolicy: "cache-first",
    // Partial data surfaced alongside errors for resilience.
    errorPolicy: "all",
    // Dealer catalog polling (approved dealers only — returns 0 for everyone
    // else so no unnecessary requests are made).
    pollInterval,
    // Don't re-render for intermediate network states (loading, refetch, poll
    // in-progress). Only re-render when a result (data or error) is final.
    notifyOnNetworkStatusChange: false,
    skip: !backendReady,
    // publicCatalog: true instructs publicCatalogLink (apolloClient.ts) to
    // inject x-public-catalog: 1 so the server skips session middleware for
    // this unauthenticated catalog request — saving a Redis round-trip.
    // Note: when a logged-in dealer triggers refetch() below, Apollo sends a
    // fresh request with this context, which is correct — dealer pricing is
    // resolved server-side via the JWT cookie, not via session middleware.
    context: { publicCatalog: true },
  });

  // After auth resolves, refetch once per user so dealer-specific prices
  // replace the anonymous catalog data that was seeded from SSR.
  useEffect(() => {
    if (!backendReady || isAuthLoading || !user?.id) {
      return;
    }

    if (refreshedUserIdRef.current === user.id) {
      return;
    }

    refreshedUserIdRef.current = user.id;
    void refetch();
  }, [isAuthLoading, user?.id, refetch]);

  // Promote fresh network data into display state but never regress to empty.
  useEffect(() => {
    const fresh = data?.products?.products;
    if (Array.isArray(fresh) && fresh.length > 0) {
      setProducts(fresh);
      hasEverLoadedRef.current = true;
    }
  }, [data]);

  // A network error is only surfaced as a visible error banner when:
  //   1. The query has actually FAILED (networkStatus === error, value 8).
  //      NetworkStatus.refetch (4) means a refetch is in-progress — it is NOT
  //      an error and should not be treated as one.
  //   2. We genuinely have no data to show (both SSR and every subsequent
  //      fetch returned nothing).
  //   3. We had previously-loaded products that are now gone — i.e. this is a
  //      regression, not simply "no products exist with this flag".
  //
  // Rationale for condition 3: sections backed by empty DB flags (e.g. no
  // products marked isFeatured) should show an empty state, not a scary red
  // error banner. The banner is reserved for cases where we KNOW the data
  // existed and is now unreachable.
  const isRealNetworkError = networkStatus === NetworkStatus.error;

  const displayError =
    backendReady &&
    error &&
    products.length === 0 &&
    isRealNetworkError &&
    hasEverLoadedRef.current
      ? error
      : undefined;

  // Show a skeleton only during the very first in-flight network fetch AND
  // only when we have no SSR data and have never loaded anything before.
  // This covers the edge case where SSR failed AND the cache is cold.
  const isInitialLoad =
    (!backendReady || networkStatus === NetworkStatus.loading) &&
    products.length === 0 &&
    !hasEverLoadedRef.current;

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
      error={displayError}
      showTitle={showTitle}
    />
  );
};

export default HydratedProductSection;
