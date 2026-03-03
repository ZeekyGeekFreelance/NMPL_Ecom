import { gql } from "@apollo/client";

export const GET_PRODUCTS_SUMMARY = gql`
  query GetFlaggedProducts($first: Int, $flags: [String!]) {
    products(first: $first, filters: { flags: $flags }) {
      products {
        id
        slug
        name
        thumbnail
        minPrice
        maxPrice
        category {
          id
          slug
          name
        }
      }
    }
  }
`;

export const GET_PRODUCTS = gql`
  query GetProducts($first: Int, $skip: Int, $filters: ProductFilters) {
    products(first: $first, skip: $skip, filters: $filters) {
      products {
        id
        slug
        name
        thumbnail
        minPrice
        maxPrice
        category {
          id
          slug
          name
        }
      }
      hasMore
      totalCount
    }
  }
`;

export const GET_SINGLE_PRODUCT = gql`
  query GetSingleProduct($slug: String!) {
    product(slug: $slug) {
      id
      name
      slug
      isNew
      isFeatured
      isTrending
      isBestSeller
      description
      variants {
        id
        sku
        price
        images
        stock
        lowStockThreshold
        barcode
        attributes {
          id
          attribute {
            id
            name
            slug
          }
          value {
            id
            value
            slug
          }
        }
      }
      category {
        id
        name
        slug
      }
    }
  }
`;

export const GET_CATEGORIES = gql`
  query GetCategories($first: Int) {
    categories(first: $first) {
      id
      slug
      name
      description
    }
  }
`;
