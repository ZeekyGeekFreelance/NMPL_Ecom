import { ApolloClient, InMemoryCache, HttpLink, from } from "@apollo/client";
import { onError } from "@apollo/client/link/error";
import { loadDevMessages, loadErrorMessages } from "@apollo/client/dev";
import { GRAPHQL_URL } from "./constants/config";

if (process.env.NODE_ENV !== "production") {
  loadDevMessages();
  loadErrorMessages();
}

const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (process.env.NODE_ENV !== "production") {
    if (graphQLErrors) console.error("GraphQL Error", graphQLErrors);
    if (networkError) console.error("Network Error", networkError);
  }
});
export const initializeApollo = (initialState = null) => {
  const httpLink = new HttpLink({
    uri: GRAPHQL_URL,
    credentials: "include",
  });

  // Create or reuse Apollo Client instance
  const client = new ApolloClient({
    link: from([errorLink, httpLink]),
    cache: new InMemoryCache({
      typePolicies: {
        Product: {
          fields: {
            variants: {
              // Variants is an array field. Returning the latest server payload
              // avoids Apollo's "Cannot automatically merge arrays" invariant error.
              merge(existing, incoming) {
                return incoming ?? existing ?? [];
              },
            },
          },
        },
      },
    }).restore(initialState || {}),
  });

  return client;
};

export default initializeApollo(); // Default export for client-side usage
