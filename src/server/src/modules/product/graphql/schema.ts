import gql from "graphql-tag";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { productResolvers } from "./resolver";

const typeDefs = gql`
  type Product {
    id: String!
    slug: String!
    name: String!
    thumbnail: String
    price: Float!
    description: String
    salesCount: Int!
    isNew: Boolean!
    isFeatured: Boolean!
    isTrending: Boolean!
    isBestSeller: Boolean!
    variants(first: Int, skip: Int): [ProductVariant!]!
    category: Category
  }

  type ProductCard {
    id: String!
    name: String!
    slug: String!
    thumbnail: String
    minPrice: Float!
    maxPrice: Float!
    dealerMinPrice: Float
    dealerMaxPrice: Float
    category: Category
  }

  type ProductVariant {
    id: String!
    sku: String!
    images: [String!]!
    price: Float!
    retailPrice: Float!
    stock: Int!
    lowStockThreshold: Int!
    barcode: String
    attributes: [ProductVariantAttribute!]!
  }

  type ProductVariantAttribute {
    id: String!
    attribute: Attribute!
    value: AttributeValue!
  }

  type Attribute {
    id: String!
    name: String!
    slug: String!
  }

  type AttributeValue {
    id: String!
    value: String!
    slug: String!
  }

  type User {
    id: String!
    name: String!
    email: String!
    avatar: String
  }

  type Category {
    id: String!
    slug: String!
    name: String!
    description: String
  }

  type ProductConnection {
    products: [ProductCard!]!
    hasMore: Boolean!
    totalCount: Int
  }

  input ProductFilters {
    search: String
    isNew: Boolean
    isFeatured: Boolean
    isTrending: Boolean
    isBestSeller: Boolean
    minPrice: Float
    maxPrice: Float
    categoryId: String
    flags: [String!]
  }

  type Query {
    products(first: Int, skip: Int, filters: ProductFilters): ProductConnection!
    product(slug: String!): Product
    newProducts(first: Int, skip: Int): ProductConnection!
    featuredProducts(first: Int, skip: Int): ProductConnection!
    trendingProducts(first: Int, skip: Int): ProductConnection!
    bestSellerProducts(first: Int, skip: Int): ProductConnection!
    categories(first: Int, skip: Int): [Category!]!
  }
`;

export const productSchema = makeExecutableSchema({
  typeDefs: typeDefs,
  resolvers: productResolvers,
});
