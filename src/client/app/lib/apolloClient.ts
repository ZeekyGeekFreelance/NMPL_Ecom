import {
  ApolloClient,
  ApolloLink,
  InMemoryCache,
  from,
} from "@apollo/client";
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

/**
 * publicCatalogLink
 *
 * Fix: the x-public-catalog header was previously hardcoded on the
 * BatchHttpLink, which meant every GraphQL request — including auth-required
 * queries and mutations — carried it. On the server, app.ts uses this header
 * as a signal to skip session + passport middleware entirely:
 *
 *   if (isPublicCatalog(req)) { next(); return; }  // skips session hydration
 *
 * Sending it on authenticated mutations caused req.session to be undefined
 * in those handlers, and could silently suppress session-backed auth state.
 *
 * The fix uses an ApolloLink middleware to inject the header only when the
 * calling code explicitly opts in via Apollo operation context:
 *
 *   useQuery(GET_PRODUCTS, { context: { publicCatalog: true } })
 *
 * All public catalog queries (product listing, product detail, categories,
 * home page data) already pass this context. Auth queries, mutations, and
 * admin operations do not, so they receive normal session handling.
 *
 * Backward compatibility: any operation that does NOT set publicCatalog in
 * context will simply not send the header — the server will apply full session
 * middleware, which is correct and safe.
 */
const publicCatalogLink = new ApolloLink((operation, forward) => {
  const { publicCatalog } = operation.getContext();
  if (publicCatalog) {
    operation.setContext(({ headers = {} }: { headers?: Record<string, string> }) => ({
      headers: {
        ...headers,
        "x-public-catalog": "1",
      },
    }));
  }
  return forward(operation);
});

// Singleton — reused across renders on the client so the cache persists.
// On the server a fresh instance is always created (no module-level state
// between requests).
let _clientInstance: ApolloClient<any> | null = null;

const createApolloClient = (initialState: any = null) => {
  // BatchHttpLink merges concurrent queries (e.g. GET_PRODUCTS + GET_CATEGORIES
  // on the shop page) into a single HTTP POST, halving round trips.
  // batchInterval: wait up to 10ms for more queries before flushing.
  //   20ms was too generous — single-query navigations paid 20ms for nothing.
  //   10ms is enough to collect queries fired in the same render cycle.
  // batchMax: never bundle more than 5 queries in one request.
  const httpLink = new BatchHttpLink({
    uri: GRAPHQL_URL,
    credentials: "include",
    batchInterval: 10,
    batchMax: 5,
    // No default headers here — publicCatalogLink injects x-public-catalog
    // only for operations that explicitly opt in via context: { publicCatalog: true }.
  });

  const retryLink = new RetryLink({
    attempts: {
      // 12 retries with exponential backoff covers the full server cold-start
      // window including the 5-min useBackendReady timeout. If the health gate
      // releases after the full 5-min timeout (worst case), Apollo still has
      // retries remaining so the query recovers without showing an error banner.
      // Total cumulative wait: ~5-6 minutes before surfacing an error.
      max: 12,
      retryIf: (error) => {
        if (!error) return false;

        // Always retry transient network failures ("Failed to fetch",
        // ECONNREFUSED etc.) — these are cold-start / flaky network errors.
        if (isEndpointUnreachableError(error)) return true;

        const statusCode = getErrorStatusCode(error);
        if (typeof statusCode !== "number") return false;

        // Retry server errors (5xx) and rate-limit (429) responses.
        // 503 is returned while the server is still in its startup health-gate.
        return statusCode === 429 || statusCode >= 500;
      },
    },
    delay: (count, _operation, error) => {
      const statusCode = getErrorStatusCode(error);

      // For 429 rate-limit responses use pure exponential backoff with full
      // jitter to avoid thundering herd: random value in [0, base * 2^attempt].
      // This spreads retries across a wide window so clients don't all retry
      // at the same moment after a rate-limit event.
      if (statusCode === 429) {
        const base = 1000;
        const cap = 30_000;
        const ceiling = Math.min(cap, base * Math.pow(2, count));
        return Math.random() * ceiling;
      }

      // For cold-start / transient network errors use exponential backoff so
      // retries spread across the full server startup window.
      // Attempt 1→~1s, 2→~2s, 3→~4s, 4→~8s, 5→~16s, 6→~30s, 7→~30s, 8→~30s.
      const baseColdStart = 1_000;
      const capColdStart = 30_000;
      const ceiling = Math.min(capColdStart, baseColdStart * Math.pow(2, count - 1));
      return ceiling * (0.5 + Math.random() * 0.5); // 50-100% of ceiling for jitter
    },
  });

  return new ApolloClient({
    // SSR mode prevents the client from being stored as a singleton so each
    // server render gets a clean instance.
    ssrMode: typeof window === "undefined",
    link: from([errorLink, publicCatalogLink, retryLink, httpLink]),
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
};

export const initializeApollo = (initialState: any = null) => {
  // Server: always create a fresh client — no shared state between requests.
  if (typeof window === "undefined") {
    return createApolloClient(initialState);
  }

  // Client: reuse the singleton so the in-memory cache survives navigation.
  // Merge any server-side initialState into the existing cache on first mount.
  if (!_clientInstance) {
    _clientInstance = createApolloClient(initialState);
  } else if (initialState) {
    _clientInstance.cache.restore({
      ..._clientInstance.cache.extract(),
      ...initialState,
    });
  }

  return _clientInstance;
};

export default initializeApollo(); // Default export for client-side usage
