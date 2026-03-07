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
};

export default nextConfig;
