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

/**
 * Build-time values, always inlined (an unset NEXT_PUBLIC_* value would stay
 * a runtime lookup). NEXT_PUBLIC_E2E is "0" unless the e2e build sets "1", so
 * the test hooks compile out of the build that ships. NEXT_PUBLIC_JIM_TENANT
 * is Jim's sign-in tenant id (public), given at deploy; without it Jim's
 * sign-in says it isn't set up.
 */
const buildEnv = {
  NEXT_PUBLIC_BUILD_ID: readBuildId(),
  NEXT_PUBLIC_E2E: process.env.NEXT_PUBLIC_E2E ?? "0",
  NEXT_PUBLIC_JIM_TENANT: process.env.NEXT_PUBLIC_JIM_TENANT ?? "",
};

const nextConfig: NextConfig = {
  output: "export",
  env: buildEnv,
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
