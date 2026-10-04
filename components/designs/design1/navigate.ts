/**
 * Thin wrapper over `window.location.assign`. jsdom's `location` is not
 * configurable, so tests mock this module instead of the global.
 */
export function navigateTo(url: string): void {
  window.location.assign(url);
}
