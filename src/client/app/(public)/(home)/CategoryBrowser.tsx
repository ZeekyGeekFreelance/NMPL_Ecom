/**
 * DEPRECATED — do not import this file.
 *
 * CategoryBrowser used useGetAllCategoriesQuery (RTK Query REST) alongside
 * the GraphQL product queries, creating a split data layer on boot.
 * It is not rendered anywhere in the current routing tree.
 *
 * If this UI is ever re-enabled, rebuild it using HydratedCategoryBar
 * (SSR props) or by adding categories to the GraphQL query instead of
 * hitting the REST /categories endpoint separately.
 */
