import { ApolloClient, InMemoryCache, HttpLink, from } from "@apollo/client";
import { onError } from "@apollo/client/link/error";
import { RetryLink } from "@apollo/client/link/retry";
import { loadDevMessages, loadErrorMessages } from "@apollo/client/dev";
import { GRAPHQL_URL } from "./constants/config";

if (process.env.NODE_ENV !== "production") {
  loadDevMessages();
  loadErrorMessages();
}

const NETWORK_FAILURE_PATTERNS = [
  /failed to fetch/i,
  /fetch failed/i,
  /network request failed/i,
  /econnrefused/i,
  /enotfound/i,
  /ecanceled/i,
  /aborted/i,
];

const getErrorMessage = (error: unknown) => {
  if (!error || typeof error !== "object") {
    return "";
  }

  const typedError = error as { message?: unknown };
  return typeof typedError.message === "string" ? typedError.message : "";
};

const getErrorStatusCode = (error: unknown): number | undefined => {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const typedError = error as {
    statusCode?: unknown;
    status?: unknown;
    response?: { status?: unknown };
  };

  const directStatus =
    typeof typedError.statusCode === "number"
      ? typedError.statusCode
      : typeof typedError.status === "number"
      ? typedError.status
      : undefined;

  if (typeof directStatus === "number") {
    return directStatus;
  }

  return typeof typedError.response?.status === "number"
    ? typedError.response.status
    : undefined;
};

const isEndpointUnreachableError = (error: unknown) => {
  const message = getErrorMessage(error);
  if (!message) {
    return false;
  }

  return NETWORK_FAILURE_PATTERNS.some((pattern) => pattern.test(message));
};

const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (process.env.NODE_ENV !== "production") {
    if (graphQLErrors) console.error("GraphQL Error", graphQLErrors);
    if (networkError) {
      if (isEndpointUnreachableError(networkError)) {
        console.error(
          `[Apollo] Unable to reach GraphQL endpoint: ${GRAPHQL_URL}`,
          networkError
        );
      } else {
        console.error("Network Error", networkError);
      }
    }
  }
});
export const initializeApollo = (initialState = null) => {
  const httpLink = new HttpLink({
    uri: GRAPHQL_URL,
    credentials: "include",
  });
  const retryLink = new RetryLink({
    attempts: {
      max: 3,
      retryIf: (error) => {
        if (!error) {
          return false;
        }

        if (isEndpointUnreachableError(error)) {
          return false;
        }

        const statusCode = getErrorStatusCode(error);
        if (typeof statusCode !== "number") {
          return false;
        }

        return statusCode === 429 || statusCode >= 500;
      },
    },
    delay: {
      initial: 300,
      max: 1500,
      jitter: true,
    },
  });

  // Create or reuse Apollo Client instance
  const client = new ApolloClient({
    link: from([errorLink, retryLink, httpLink]),
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
