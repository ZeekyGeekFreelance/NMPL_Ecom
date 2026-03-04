/**
 * Home page — React Server Component.
 *
 * All product and category data is fetched on the server during SSR.
 * The client receives a fully-populated HTML response, so there is no
 * "Failed to fetch" flash on initial load — the data is already there.
 *
 * Client components (HydratedProductSection, HydratedCategoryBar) use
 * the SSR data immediately and silently sync with Apollo in the
 * background for live updates (e.g. dealer catalog polling).
 */

import { fetchHomePageData } from "./(public)/(home)/fetchHomePageData";
import HydratedProductSection from "./(public)/product/HydratedProductSection";
import HydratedCategoryBar from "./(public)/(home)/HydratedCategoryBar";
import StoreHighlights from "./(public)/(home)/StoreHighlights";
import HeroSection from "./(public)/(home)/HeroSection";
import MainLayout from "./components/templates/MainLayout";

export default async function Home() {
  // Fetch all data on the server — parallel, fault-tolerant.
  // Individual section failures return [] so the page always renders.
  const { featured, trending, newArrivals, bestSellers, categories } =
    await fetchHomePageData();

  return (
    <MainLayout>
      <HeroSection />
      <HydratedCategoryBar categories={categories} />
      <StoreHighlights />
      <HydratedProductSection
        title="Featured"
        initialProducts={featured}
        filters={{ isFeatured: true }}
        showTitle
      />
      <HydratedProductSection
        title="Trending"
        initialProducts={trending}
        filters={{ isTrending: true }}
        showTitle
      />
      <HydratedProductSection
        title="New Arrivals"
        initialProducts={newArrivals}
        filters={{ isNew: true }}
        showTitle
      />
      <HydratedProductSection
        title="Best Sellers"
        initialProducts={bestSellers}
        filters={{ isBestSeller: true }}
        showTitle
      />
    </MainLayout>
  );
}
