import { LOCAL_HOSTS } from "@/lib/analytics/localHosts";

/**
 * The only host /jim runs on: Jim's own Hosting site, the origin the Cloud
 * Run server allows. Any other host that still serves the page (the main
 * site's old address, web.app, firebaseapp.com) is sent here before
 * anything else happens.
 */
export const JIM_HOST = "jim.gentryriggen.com";
export const JIM_URL = `https://${JIM_HOST}/jim`;

export interface JimHostEnv {
  isProduction: boolean;
  /** True in e2e builds (NEXT_PUBLIC_E2E). */
  isE2E: boolean;
}

function buildEnv(): JimHostEnv {
  return {
    isProduction: process.env.NODE_ENV === "production",
    isE2E: process.env.NEXT_PUBLIC_E2E === "1",
  };
}

/**
 * Where /jim should go instead, or null to stay. Never redirects on
 * localhost or in dev and e2e builds.
 */
export function jimRedirectTarget(
  hostname: string,
  env: JimHostEnv = buildEnv()
): string | null {
  if (!env.isProduction || env.isE2E) return null;
  if (LOCAL_HOSTS.has(hostname) || hostname === JIM_HOST) return null;
  return JIM_URL;
}

/** Replaces this page in history, so Back doesn't return to the other domain. */
export function goTo(url: string): void {
  window.location.replace(url);
}
