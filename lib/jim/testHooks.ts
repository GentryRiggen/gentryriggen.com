/**
 * Test hooks for /jim. On in development and in the e2e build
 * (`NEXT_PUBLIC_E2E=1`), off in the build that ships, so they compile away.
 * They only change what the page shows; the server checks every request.
 */
export const TEST_HOOKS_ENABLED =
  process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_E2E === "1";

export interface JimTestHook {
  /** Skip Firebase and act as the signed-in owner. */
  signedIn?: boolean;
  /** Use this server URL instead of JIM_API. */
  api?: string;
}

declare global {
  interface Window {
    /** Set by an e2e test before the page loads. */
    __JIM_TEST__?: JimTestHook;
  }
}

export function jimTestHook(): JimTestHook | undefined {
  if (!TEST_HOOKS_ENABLED || typeof window === "undefined") return undefined;
  return window.__JIM_TEST__;
}
