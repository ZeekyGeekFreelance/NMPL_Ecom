import { ApolloClient, InMemoryCache, from } from "@apollo/client";
import { BatchHttpLink } from "@apollo/client/link/batch-http";
import { onError } from "@apollo/client/link/error";
import { RetryLink } from "@apollo/client/link/retry";
import { loadDevMessages, loadErrorMessages } from "@apollo/client/dev";
import { GRAPHQL_URL } from "./constants/config";
import { runtimeEnv } from "./runtimeEnv";

if (!runtimeEnv.isProduction) {
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
  if (!runtimeEnv.isProduction) {
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
  // BatchHttpLink merges concurrent queries (e.g. GET_PRODUCTS + GET_CATEGORIES
  // on the shop page) into a single HTTP POST, halving round trips.
  // batchInterval: wait up to 20ms for more queries before flushing.
  // batchMax: never bundle more than 5 queries in one request.
  const httpLink = new BatchHttpLink({
    uri: GRAPHQL_URL,
    credentials: "include",
    batchInterval: 20,
    batchMax: 5,
    headers: { "x-public-catalog": "1" },
  });

  const retryLink = new RetryLink({
    attempts: {
      max: 4,
      retryIf: (error, _operation) => {
        if (!error) return false;

        // Always retry transient network failures ("Failed to fetch",
        // ECONNREFUSED etc.) — these are cold-start / flaky network errors.
        if (isEndpointUnreachableError(error)) return true;

        const statusCode = getErrorStatusCode(error);
        if (typeof statusCode !== "number") return false;

        // Retry server errors and rate-limit responses.
        return statusCode === 429 || statusCode >= 500;
      },
    },
    delay: (count, _operation, error) => {
      const statusCode = getErrorStatusCode(error);

      // For 429 rate-limit responses use pure exponential backoff with full
      // jitter to avoid thundering herd: random value in [0, base * 2^attempt].
      // This spreads retries across a wide window so clients don’t all retry
      // at the same moment after a rate-limit event.
      if (statusCode === 429) {
        const base = 1000;
        const cap = 30_000;
        const ceiling = Math.min(cap, base * Math.pow(2, count));
        return Math.random() * ceiling;
      }

      // For transient network errors use shorter fixed jitter window.
      const initial = 500;
      const max = 3000;
      return initial + Math.random() * (max - initial);
    },
  });

  // Create or reuse Apollo Client instance
  const client = new ApolloClient({
    link: from([errorLink, retryLink, httpLink]),
    cache: new InMemoryCache({
      typePolicies: {
        // ProductConnection is not normalised by id — it's a query-level
        // result.  Merging by replacing prevents the "Cannot merge arrays"
        // invariant when the same query is written multiple times (e.g.
        // writeQuery from SSR seed + background poll).
        ProductConnection: {
          merge: true,
        },
        Product: {
          fields: {
            variants: {
              merge(_existing, incoming) {
                return incoming ?? [];
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
