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

const distDir = (process.env.NEXT_DIST_DIR || ".next").trim() || ".next";

const nextConfig: NextConfig = {
  // Separate dev and production artifacts so a build/clean cannot corrupt a
  // live dev server by mutating the same .next directory.
  distDir,
  // Produce a self-contained build under distDir/standalone — required for the
  // multi-stage Dockerfile (copies only the standalone folder, not node_modules).
  output: "standalone",
  // Keep the standalone output rooted at the client app directory even in a
  // monorepo, so the runtime expects distDir/static under the same root.
  outputFileTracingRoot: process.cwd(),

  // Gzip/Brotli compress all responses (HTML, JSON, JS chunks).
  // Cuts payload size ~65-70% on typical pages at negligible CPU cost.
  compress: true,

  images: {
    remotePatterns: ALLOWED_IMAGE_HOSTNAMES.map((hostname) => ({
      protocol: "https",
      hostname,
    })),
  },

  // Expose the public API URL as a build-time environment variable so it is
  // baked into the client bundle. Required in addition to the NEXT_PUBLIC_ prefix.
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "",
  },

  webpack: (config, { dev }) => {
    // Replace eval-based source maps with a safe alternative in all environments.
    // eval-source-map (Next.js dev default) triggers CWE-94 because webpack's
    // global resolver emits `new Function('return this')()` as a fallback.
    // cheap-module-source-map gives equivalent line-level accuracy without eval.
    config.devtool = dev ? "cheap-module-source-map" : false;

    // Tell webpack the target supports globalThis natively so it never emits
    // the `new Function('return this')` shim (the CWE-94 vector at line 369).
    config.output = {
      ...config.output,
      globalObject: "globalThis",
    };

    return config;
  },
};

export default nextConfig;
