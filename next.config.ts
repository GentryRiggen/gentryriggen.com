import { execSync } from "node:child_process";
import type { NextConfig } from "next";

/**
 * Identifies this build, so an open Ever Onward tab can tell when a newer
 * one has been deployed. CI provides the commit; otherwise ask git.
 */
function readBuildId(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 12);
  try {
    return execSync("git rev-parse --short=12 HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return "dev";
  }
}

const nextConfig: NextConfig = {
  output: "export",
  env: { NEXT_PUBLIC_BUILD_ID: readBuildId() },
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
