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
  // Produce a self-contained standalone build for Docker/production deploys.
  output: "standalone",

  // Gzip/Brotli compress all responses.
  compress: true,

  images: {
    qualities: [75, 100],
    remotePatterns: ALLOWED_IMAGE_HOSTNAMES.map((hostname) => ({
      protocol: "https" as const,
      hostname,
    })),
  },

  // Expose the API URL to the client bundle.
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "",
  },

  webpack: (config, { dev }) => {
    // Avoid eval-based source maps (CWE-94).
    config.devtool = dev ? "cheap-module-source-map" : false;
    config.output = {
      ...config.output,
      globalObject: "globalThis",
    };
    return config;
  },
};

export default nextConfig;
