import { ApolloClient, InMemoryCache, HttpLink, from } from "@apollo/client";

/**
 * SSR-only Apollo client.
 *
 * Priority for the GraphQL endpoint:
 *   INTERNAL_API_URL   — direct service-to-service URL, never reaches the
 *                        browser bundle.  Set this to the backend's internal
 *                        address in production (e.g. http://api:5001/api/v1).
 *   NEXT_PUBLIC_API_URL — public fallback used in development when both
 *                        services run on localhost.
 */
function resolveServerGraphQLUrl(): string {
  const raw =
    process.env.INTERNAL_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    "";

  if (!raw) {
    throw new Error(
      "[apolloServerClient] Neither INTERNAL_API_URL nor NEXT_PUBLIC_API_URL is set."
    );
  }

  const base = raw.replace(/\/+$/, "");
  // Normalise: ensure the path ends with /api/v1 before appending /graphql.
  const apiBase = /\/api\/v1$/i.test(base) ? base : `${base}/api/v1`;
  return `${apiBase}/graphql`;
}

const SERVER_GRAPHQL_URL = resolveServerGraphQLUrl();

// 8-second hard timeout for SSR fetches.  If the backend doesn't respond
// within this window the section falls back to [] and the client self-heals.
const SSR_FETCH_TIMEOUT_MS = 8_000;

function fetchWithTimeout(
  url: RequestInfo | URL,
  options?: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SSR_FETCH_TIMEOUT_MS);

  return fetch(url, {
    ...options,
    // No-store: always fetch fresh data during SSR.
    // Swap to `next: { revalidate: 60 }` here if you want ISR.
    cache: "no-store",
    signal: controller.signal,
  }).finally(() => clearTimeout(timer));
}

/**
 * Returns a fresh Apollo client for each SSR request.
 * Each call gets its own InMemoryCache — no shared state between requests.
 */
export function createServerApolloClient(): ApolloClient<object> {
  const httpLink = new HttpLink({
    uri: SERVER_GRAPHQL_URL,
    credentials: "include",
    fetch: fetchWithTimeout,
    headers: { "x-public-catalog": "1" },
  });

  return new ApolloClient({
    link: from([httpLink]),
    cache: new InMemoryCache(),
    ssrMode: true,
    // Disable Apollo's own dev-tool telemetry on the server.
    connectToDevTools: false,
  });
}
