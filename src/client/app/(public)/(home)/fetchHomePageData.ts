import { cache } from "react";
import { createServerApolloClient } from "@/app/lib/apolloServerClient";
import { GET_HOME_PAGE_DATA } from "@/app/gql/Product";
import { Product } from "@/app/types/productTypes";

const SECTION_PAGE_SIZE = 12;

export interface HomePageData {
  featured: Product[];
  trending: Product[];
  newArrivals: Product[];
  bestSellers: Product[];
  categories: { id: string; slug: string; name: string; description?: string }[];
}

/**
 * Fetches all home page data in a SINGLE GraphQL query during SSR.
 * One network round-trip instead of five.
 * Wrapped with React cache() so the result is shared across the render tree.
 */
export const fetchHomePageData = cache(async (): Promise<HomePageData> => {
  try {
    const client = createServerApolloClient();
    const { data } = await client.query({
      query: GET_HOME_PAGE_DATA,
      variables: { pageSize: SECTION_PAGE_SIZE },
    });

    return {
      featured:    data?.featured?.products    ?? [],
      trending:    data?.trending?.products    ?? [],
      newArrivals: data?.newArrivals?.products ?? [],
      bestSellers: data?.bestSellers?.products ?? [],
      categories:  data?.categories            ?? [],
    };
  } catch {
    return { featured: [], trending: [], newArrivals: [], bestSellers: [], categories: [] };
  }
});
