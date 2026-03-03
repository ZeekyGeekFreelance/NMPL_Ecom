"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@apollo/client";
import { GET_PRODUCTS } from "./gql/Product";
import SkeletonLoader from "./components/feedback/SkeletonLoader";
import { useDealerCatalogPollInterval } from "./hooks/network/useDealerCatalogPollInterval";

const HeroSection = dynamic(() => import("./(public)/(home)/HeroSection"), {
  ssr: false,
});
const CategoryBar = dynamic(() => import("./(public)/(home)/CategoryBar"), {
  ssr: false,
});
const StoreHighlights = dynamic(
  () => import("./(public)/(home)/StoreHighlights"),
  { ssr: false }
);
const ProductSection = dynamic(
  () => import("./(public)/product/ProductSection"),
  { ssr: false }
);
const MainLayout = dynamic(() => import("./components/templates/MainLayout"), {
  ssr: false,
});

const SECTION_PAGE_SIZE = 12;
const BOOT_RETRY_LIMIT = 3;
const BOOT_RETRY_DELAY_MS = 1200;

const Home = () => {
  const dealerCatalogPollInterval = useDealerCatalogPollInterval();
  const [bootRetryCount, setBootRetryCount] = useState(0);

  const sharedQueryOptions = useMemo(
    () => ({
      fetchPolicy: "cache-and-network" as const,
      nextFetchPolicy: "cache-first" as const,
      errorPolicy: "all" as const,
      pollInterval: dealerCatalogPollInterval,
      notifyOnNetworkStatusChange: true,
    }),
    [dealerCatalogPollInterval]
  );

  const featuredQuery = useQuery(GET_PRODUCTS, {
    variables: {
      first: SECTION_PAGE_SIZE,
      skip: 0,
      filters: { isFeatured: true },
    },
    ...sharedQueryOptions,
  });
  const trendingQuery = useQuery(GET_PRODUCTS, {
    variables: {
      first: SECTION_PAGE_SIZE,
      skip: 0,
      filters: { isTrending: true },
    },
    ...sharedQueryOptions,
  });
  const newArrivalsQuery = useQuery(GET_PRODUCTS, {
    variables: {
      first: SECTION_PAGE_SIZE,
      skip: 0,
      filters: { isNew: true },
    },
    ...sharedQueryOptions,
  });
  const bestSellersQuery = useQuery(GET_PRODUCTS, {
    variables: {
      first: SECTION_PAGE_SIZE,
      skip: 0,
      filters: { isBestSeller: true },
    },
    ...sharedQueryOptions,
  });

  const featured = featuredQuery.data?.products?.products || [];
  const trending = trendingQuery.data?.products?.products || [];
  const newArrivals = newArrivalsQuery.data?.products?.products || [];
  const bestSellers = bestSellersQuery.data?.products?.products || [];

  const sectionStates = useMemo(
    () => [
      { query: featuredQuery, products: featured, key: "featured" },
      { query: trendingQuery, products: trending, key: "trending" },
      { query: newArrivalsQuery, products: newArrivals, key: "new" },
      { query: bestSellersQuery, products: bestSellers, key: "best" },
    ],
    [
      featuredQuery,
      trendingQuery,
      newArrivalsQuery,
      bestSellersQuery,
      featured,
      trending,
      newArrivals,
      bestSellers,
    ]
  );

  const hasProducts = [featured, trending, newArrivals, bestSellers].some(
    (sectionProducts) => sectionProducts.length > 0
  );

  const failedSections = sectionStates.filter(
    (section) => section.query.error && section.products.length === 0
  );
  const hasBootFailure = failedSections.length > 0;

  useEffect(() => {
    if (!hasBootFailure) {
      if (bootRetryCount !== 0) {
        setBootRetryCount(0);
      }
      return;
    }

    if (hasProducts || bootRetryCount >= BOOT_RETRY_LIMIT) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setBootRetryCount((previous) => previous + 1);
      failedSections.forEach((section) => {
        void section.query.refetch();
      });
    }, BOOT_RETRY_DELAY_MS);

    return () => clearTimeout(timeoutId);
  }, [
    bootRetryCount,
    failedSections,
    hasBootFailure,
    hasProducts,
  ]);

  const isLoading =
    (featuredQuery.loading ||
      trendingQuery.loading ||
      newArrivalsQuery.loading ||
      bestSellersQuery.loading) &&
    !hasProducts;

  if (isLoading) {
    return (
      <MainLayout>
        <HeroSection />
        <SkeletonLoader />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <HeroSection />
      <CategoryBar />
      <StoreHighlights />
      <ProductSection
        title="Featured"
        products={featured}
        loading={false}
        error={featured.length ? undefined : featuredQuery.error}
        showTitle={true}
      />
      <ProductSection
        title="Trending"
        products={trending}
        loading={false}
        error={trending.length ? undefined : trendingQuery.error}
        showTitle={true}
      />
      <ProductSection
        title="New Arrivals"
        products={newArrivals}
        loading={false}
        error={newArrivals.length ? undefined : newArrivalsQuery.error}
        showTitle={true}
      />
      <ProductSection
        title="Best Sellers"
        products={bestSellers}
        loading={false}
        error={bestSellers.length ? undefined : bestSellersQuery.error}
        showTitle={true}
      />
    </MainLayout>
  );
};

export default Home;
