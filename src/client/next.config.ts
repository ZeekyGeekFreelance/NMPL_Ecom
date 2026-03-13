import type { NextConfig } from "next";

const ALLOWED_IMAGE_HOSTNAMES = [
  "m.media-amazon.com",
  "www.bestbuy.com",
  "www.dyson.com",
  "store.hp.com",
  "i1.adis.ws",
  "i5.walmartimages.com",
  "lh3.googleusercontent.com",
  "res.cloudinary.com",
  "pbs.twimg.com",
  "store.storeimages.cdn-apple.com",
];

const nextConfig: NextConfig = {
  // Produce a self-contained build under .next/standalone — required for the
  // multi-stage Dockerfile (copies only the standalone folder, not node_modules).
  output: "standalone",

  // Gzip/Brotli compress all responses (HTML, JSON, JS chunks).
  // Cuts payload size ~65-70% on typical pages at negligible CPU cost.
  compress: true,

  images: {
    remotePatterns: ALLOWED_IMAGE_HOSTNAMES.map((hostname) => ({
      protocol: "https",
      hostname,
    })),
  },

  // Expose INTERNAL_API_URL to the Next.js server runtime (SSR) only.
  // This is NOT exposed to the browser — it is used by server-side fetch calls
  // so SSR can use a private/internal network instead of the public API URL.
  serverRuntimeConfig: {
    internalApiUrl: process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "",
  },

  // Expose the public API URL as a build-time environment variable so it is
  // baked into the client bundle. Required in addition to the NEXT_PUBLIC_ prefix.
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "",
  },
};

export default nextConfig;
