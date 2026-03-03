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
  images: {
    remotePatterns: ALLOWED_IMAGE_HOSTNAMES.map((hostname) => ({
      protocol: "https",
      hostname,
    })),
  },
};

export default nextConfig;
