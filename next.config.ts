import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // `page.dev.tsx` (the asset studio) is a route in dev only; production
  // builds do not treat it as a page.
  pageExtensions:
    process.env.NODE_ENV === "development"
      ? ["dev.tsx", "tsx", "ts", "jsx", "js"]
      : ["tsx", "ts", "jsx", "js"],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
