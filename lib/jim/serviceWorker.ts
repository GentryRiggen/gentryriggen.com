/**
 * /jim's service worker (public/jim-sw.js): the page opens without signal
 * and the morning briefing arrives. Scoped to /jim, so it never controls
 * another page on the site.
 */

export const JIM_SW_URL = "/jim-sw.js";
export const JIM_SW_SCOPE = "/jim";

/** Same-origin resources this page has loaded, plus the page itself. */
function loadedUrls(): string[] {
  const urls =
    typeof performance.getEntriesByType === "function"
      ? performance.getEntriesByType("resource").map((entry) => entry.name)
      : [];
  return [...urls, window.location.href].filter((url) => {
    try {
      return new URL(url).origin === window.location.origin;
    } catch {
      return false;
    }
  });
}

/**
 * Registers the worker in the build that ships (not dev, not the e2e
 * build), then hands it what the page already loaded, including chunks
 * loaded before it took control (Firebase's), so one online visit is enough
 * to open offline. Best effort: Jim works online without it.
 */
export async function registerJimServiceWorker(): Promise<void> {
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.NEXT_PUBLIC_E2E === "1") return;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }
  try {
    await navigator.serviceWorker.register(JIM_SW_URL, {
      scope: JIM_SW_SCOPE,
    });
    const registration = await navigator.serviceWorker.ready;
    const post = () =>
      registration.active?.postMessage({
        type: "CACHE_URLS",
        urls: loadedUrls(),
      });
    post();
    // Chunks that load a little later (sign-in, Notes) get a second pass.
    setTimeout(post, 5_000);
  } catch {
    // Offline support is best effort.
  }
}
