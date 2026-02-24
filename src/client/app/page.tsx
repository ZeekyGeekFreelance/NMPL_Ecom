"use client";
import dynamic from "next/dynamic";
import { useQuery } from "@apollo/client";
import { GET_PRODUCTS_SUMMARY } from "./gql/Product";
import { useEffect, useMemo, useState } from "react";
import groupProductsByFlag from "./utils/groupProductsByFlag";
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

const Home = () => {
  const dealerCatalogPollInterval = useDealerCatalogPollInterval();
  const [retryCount, setRetryCount] = useState(0);

  const { data, loading, error, refetch } = useQuery(GET_PRODUCTS_SUMMARY, {
    variables: { first: 100 },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
    errorPolicy: "all",
    pollInterval: dealerCatalogPollInterval,
    notifyOnNetworkStatusChange: true,
  });

  useEffect(() => {
    if (!error) {
      if (retryCount !== 0) {
        setRetryCount(0);
      }
      return;
    }

    if (data?.products?.products?.length) {
      return;
    }

    if (retryCount >= 2) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setRetryCount((previous) => previous + 1);
      refetch({ first: 100 }).catch(() => null);
    }, 1200);

    return () => clearTimeout(timeoutId);
  }, [data?.products?.products?.length, error, refetch, retryCount]);

  const { featured, trending, newArrivals, bestSellers } = useMemo(() => {
    if (!data?.products?.products)
      return { featured: [], trending: [], newArrivals: [], bestSellers: [] };
    return groupProductsByFlag(data.products.products);
  }, [data]);

  const hasProducts = (data?.products?.products?.length || 0) > 0;
  const sectionError = hasProducts ? undefined : error;

  if (loading && !hasProducts) {
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
        error={sectionError}
        showTitle={true}
      />
      <ProductSection
        title="Trending"
        products={trending}
        loading={false}
        error={sectionError}
        showTitle={true}
      />
      <ProductSection
        title="New Arrivals"
        products={newArrivals}
        loading={false}
        error={sectionError}
        showTitle={true}
      />
      <ProductSection
        title="Best Sellers"
        products={bestSellers}
        loading={false}
        error={sectionError}
        showTitle={true}
      />
    </MainLayout>
  );
};

export default Home;

