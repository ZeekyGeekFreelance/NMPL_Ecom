import { createServerApolloClient } from "@/app/lib/apolloServerClient";
import { runtimeEnv } from "@/app/lib/runtimeEnv";
import { GET_HOME_PAGE_DATA } from "@/app/gql/Product";
import { Product } from "@/app/types/productTypes";

const SECTION_PAGE_SIZE = 12;

export interface HomePageData {
  featured: Product[];
  trending: Product[];
  newArrivals: Product[];
  bestSellers: Product[];
  categories: { id: string; slug: string; name: string; description?: string }[];
  isFallback: boolean;
}

const EMPTY_HOME_PAGE_DATA: HomePageData = {
  featured: [],
  trending: [],
  newArrivals: [],
  bestSellers: [],
  categories: [],
  isFallback: true,
};

/**
 * Fetches all home page data in a SINGLE GraphQL query during SSR.
 * One network round-trip instead of five.
 *
 * Do not memoize failures across requests. A cold-start miss or transient
 * upstream error would otherwise poison the home page until the Next process
 * restarts, leaving featured/trending sections empty long after the API is
 * healthy again.
 */
export const fetchHomePageData = async (): Promise<HomePageData> => {
  try {
    const client = await createServerApolloClient();
    const { data, errors } = await client.query({
      query: GET_HOME_PAGE_DATA,
      variables: { pageSize: SECTION_PAGE_SIZE },
      errorPolicy: "all",
      fetchPolicy: "no-cache",
    });

    if (errors && errors.length > 0 && runtimeEnv.isDevelopment) {
      console.error(
        "[home-data] GraphQL returned partial errors while loading the home page.",
        errors.map((error) => error.message)
      );
    }

    return {
      featured: data?.homePageCatalog?.featured ?? [],
      trending: data?.homePageCatalog?.trending ?? [],
      newArrivals: data?.homePageCatalog?.newArrivals ?? [],
      bestSellers: data?.homePageCatalog?.bestSellers ?? [],
      categories: data?.homePageCatalog?.categories ?? [],
      isFallback: false,
    };
  } catch (error) {
    if (runtimeEnv.isDevelopment) {
      console.error("[home-data] Failed to load home page data.", error);
    }
    return { ...EMPTY_HOME_PAGE_DATA };
  }
};
