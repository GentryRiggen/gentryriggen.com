/**
 * Whether the page exposes its test hooks (the store on `window`). On in
 * development and in the e2e build (`NEXT_PUBLIC_E2E=1`), off in the build
 * that ships.
 */
export const TEST_HOOKS_ENABLED =
  process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_E2E === "1";
