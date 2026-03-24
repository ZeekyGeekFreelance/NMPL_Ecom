import type { ShopProductFiltersInput } from "@/app/(public)/shop/shopShared";
import { GET_PRODUCTS, GET_SINGLE_PRODUCT } from "@/app/gql/Product";
import { createServerApolloClient } from "@/app/lib/apolloServerClient";
import { runtimeEnv } from "@/app/lib/runtimeEnv";
import { Product } from "@/app/types/productTypes";

export interface ProductConnectionPayload {
  products: Product[];
  hasMore: boolean;
  totalCount: number | null;
  isFallback: boolean;
}

const EMPTY_PRODUCT_CONNECTION: ProductConnectionPayload = {
  products: [],
  hasMore: false,
  totalCount: 0,
  isFallback: true,
};

export const fetchServerProductConnection = async (options: {
  first: number;
  skip?: number;
  filters?: ShopProductFiltersInput;
}): Promise<ProductConnectionPayload> => {
  try {
    const client = await createServerApolloClient();
    const { data, errors } = await client.query({
      query: GET_PRODUCTS,
      variables: {
        first: options.first,
        skip: options.skip ?? 0,
        filters: options.filters,
      },
      errorPolicy: "all",
      fetchPolicy: "no-cache",
    });

    if (errors && errors.length > 0 && runtimeEnv.isDevelopment) {
      console.error(
        "[server-products] GraphQL returned partial errors for listing fetch.",
        errors.map((error) => error.message)
      );
    }

    return {
      products: data?.products?.products ?? [],
      hasMore: Boolean(data?.products?.hasMore),
      totalCount:
        typeof data?.products?.totalCount === "number"
          ? data.products.totalCount
          : null,
      isFallback: false,
    };
  } catch (error) {
    if (runtimeEnv.isDevelopment) {
      console.error("[server-products] Failed to load product listing.", error);
    }
    return { ...EMPTY_PRODUCT_CONNECTION };
  }
};

export const fetchServerProductBySlug = async (
  slug: string
): Promise<Product | null> => {
  try {
    const client = await createServerApolloClient();
    const { data, errors } = await client.query({
      query: GET_SINGLE_PRODUCT,
      variables: { slug },
      errorPolicy: "all",
      fetchPolicy: "no-cache",
    });

    if (errors && errors.length > 0 && runtimeEnv.isDevelopment) {
      console.error(
        `[server-products] GraphQL returned partial errors for product ${slug}.`,
        errors.map((error) => error.message)
      );
    }

    return data?.product ?? null;
  } catch (error) {
    if (runtimeEnv.isDevelopment) {
      console.error(`[server-products] Failed to load product ${slug}.`, error);
    }
    return null;
  }
};
