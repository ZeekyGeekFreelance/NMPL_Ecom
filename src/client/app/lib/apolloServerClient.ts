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

// 15-second hard timeout per SSR attempt.
// Neon (serverless Postgres) can take 1–3 s to resume from suspension, so
// the original 8 s window was too tight on cold DB starts.
const SSR_FETCH_TIMEOUT_MS = 15_000;

// How many times to retry the SSR fetch before giving up and falling back
// to an empty payload (client will self-heal on mount).
const SSR_MAX_RETRIES = 2;

async function fetchWithTimeout(
  url: RequestInfo | URL,
  options?: RequestInit
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= SSR_MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SSR_FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...options,
        // No-store: always fetch fresh data during SSR.
        // Swap to `next: { revalidate: 60 }` if you want ISR.
        cache: "no-store",
        signal: controller.signal,
      });
      clearTimeout(timer);
      return response;
    } catch (err) {
      clearTimeout(timer);
      lastError = err;

      // Only retry on network/abort errors (e.g. Neon cold-start timeout).
      // Don't retry on 4xx/5xx — those are application errors.
      const isAbort = err instanceof Error && err.name === "AbortError";
      const isNetwork =
        err instanceof TypeError &&
        (err.message.toLowerCase().includes("fetch") ||
          err.message.toLowerCase().includes("network"));

      if ((!isAbort && !isNetwork) || attempt === SSR_MAX_RETRIES) {
        throw err;
      }

      // Brief pause between retries (200 ms is enough for Neon to start
      // accepting connections after the wake-up TCP round-trip succeeds).
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  throw lastError;
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
    // Public catalog header - can be overridden via env if needed
    headers: { 
      "x-public-catalog": process.env.NEXT_PUBLIC_CATALOG_HEADER || "1" 
    },
  });

  return new ApolloClient({
    link: from([httpLink]),
    cache: new InMemoryCache(),
    ssrMode: true,
    // Disable Apollo's own dev-tool telemetry on the server.
    connectToDevTools: false,
  });
}
