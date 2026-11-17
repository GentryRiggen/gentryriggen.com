/**
 * Whether a page exposes its test hooks (a `window.__<game>` object for e2e
 * and unit tests). On in development and in the e2e build
 * (`NEXT_PUBLIC_E2E=1`); off in the build that ships.
 */
export const TEST_HOOKS_ENABLED =
  process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_E2E === "1";

/**
 * Puts `hooks` on `window[name]` when enabled and returns the cleanup. Call
 * it from an effect; the gate means shipped builds never expose anything.
 *
 *   useEffect(() => createTestHooks("__flamelings", { setNow, state }), []);
 */
export function createTestHooks<T extends object>(
  name: string,
  hooks: T,
  enabled: boolean = TEST_HOOKS_ENABLED
): () => void {
  if (!enabled || typeof window === "undefined") return () => {};
  const host = window as unknown as Record<string, unknown>;
  host[name] = hooks;
  return () => {
    if (host[name] === hooks) delete host[name];
  };
}
