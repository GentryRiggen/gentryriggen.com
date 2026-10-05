/**
 * Whether the page exposes its test hooks (the store on `window`, the frozen
 * clock). On in development, and in a production build made for the e2e suite
 * (`NEXT_PUBLIC_E2E=1`); off in the build that ships, so they compile away.
 */
export const TEST_HOOKS_ENABLED =
  process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_E2E === "1";
