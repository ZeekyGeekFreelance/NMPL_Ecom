/**
 * Apollo Client stub for v99.
 * v99 uses internal Next.js API routes instead of a separate GraphQL backend.
 * This file exists only for backward compatibility with any remaining imports.
 */

// Minimal no-op client object to prevent import errors
const apolloClientStub = {
  query: async () => ({ data: null }),
  mutate: async () => ({ data: null }),
  resetStore: async () => {},
  watchQuery: () => ({ subscribe: () => {} }),
} as any;

export default apolloClientStub;
