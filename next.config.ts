import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  compress: true,
  images: {
    qualities: [75, 100],
    remotePatterns: [
      "res.cloudinary.com",
      "lh3.googleusercontent.com",
      "m.media-amazon.com",
      "i5.walmartimages.com",
      "store.hp.com",
      "pbs.twimg.com",
    ].map((hostname) => ({ protocol: "https" as const, hostname })),
  },
  webpack: (config, { dev }) => {
    config.devtool = dev ? "cheap-module-source-map" : false;
    config.output = { ...config.output, globalObject: "globalThis" };
    return config;
  },
};

export default nextConfig;
