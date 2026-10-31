import { LOCAL_HOSTS } from "@/lib/analytics/event";

/**
 * The only host /jim runs on: the Cloud Run server allows just this origin.
 * The same Hosting site also answers on other domains (and www., web.app,
 * firebaseapp.com), so the page sends those here before doing anything.
 */
export const JIM_HOST = "gentryriggen.com";
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
