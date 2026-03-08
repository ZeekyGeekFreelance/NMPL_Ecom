import { gql } from "@apollo/client";

// ── Home page — single batched query for all sections ────────────────────────
export const GET_HOME_PAGE_DATA = gql`
  query GetHomePageData($pageSize: Int) {
    featured: products(first: $pageSize, filters: { isFeatured: true }) {
      products {
        id slug name thumbnail minPrice maxPrice dealerMinPrice dealerMaxPrice
        category { id slug name }
      }
    }
    trending: products(first: $pageSize, filters: { isTrending: true }) {
      products {
        id slug name thumbnail minPrice maxPrice dealerMinPrice dealerMaxPrice
        category { id slug name }
      }
    }
    newArrivals: products(first: $pageSize, filters: { isNew: true }) {
      products {
        id slug name thumbnail minPrice maxPrice dealerMinPrice dealerMaxPrice
        category { id slug name }
      }
    }
    bestSellers: products(first: $pageSize, filters: { isBestSeller: true }) {
      products {
        id slug name thumbnail minPrice maxPrice dealerMinPrice dealerMaxPrice
        category { id slug name }
      }
    }
    # Home page shows a curated sample — 20 categories is plenty for the bar.
    # Users who want to browse all categories go to the shop filter.
    categories(first: 20) {
      id slug name description
    }
  }
`;

// ── Product listing (shop/search pages) ──────────────────────────────────────
export const GET_PRODUCTS = gql`
  query GetProducts($first: Int, $skip: Int, $filters: ProductFilters) {
    products(first: $first, skip: $skip, filters: $filters) {
      products {
        id slug name thumbnail minPrice maxPrice dealerMinPrice dealerMaxPrice
        category { id slug name }
      }
      hasMore
      totalCount
    }
  }
`;

export const GET_PRODUCTS_SUMMARY = gql`
  query GetFlaggedProducts($first: Int, $flags: [String!]) {
    products(first: $first, filters: { flags: $flags }) {
      products {
        id slug name thumbnail minPrice maxPrice dealerMinPrice dealerMaxPrice
        category { id slug name }
      }
    }
  }
`;

// ── Single product detail ─────────────────────────────────────────────────────
export const GET_SINGLE_PRODUCT = gql`
  query GetSingleProduct($slug: String!) {
    product(slug: $slug) {
      id name slug isNew isFeatured isTrending isBestSeller description
      variants {
        id sku price retailPrice images barcode
        attributes {
          id
          attribute { id name slug }
          value { id value slug }
        }
      }
      category { id name slug }
    }
  }
`;

// ── Categories ────────────────────────────────────────────────────────────────
export const GET_CATEGORIES = gql`
  query GetCategories($first: Int, $skip: Int) {
    categories(first: $first, skip: $skip) {
      id slug name description
    }
  }
`;

// Searchable category query — used by the shop filter dropdown.
// Bypasses the Redis cache on the server side (search results are not cached).
export const GET_CATEGORIES_SEARCH = gql`
  query GetCategoriesSearch($search: String, $first: Int) {
    categories(search: $search, first: $first) {
      id slug name
    }
  }
`;
