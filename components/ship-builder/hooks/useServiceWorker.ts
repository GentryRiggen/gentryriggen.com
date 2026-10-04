"use client";

import { useEffect } from "react";

export const SERVICE_WORKER_URL = "/ship-builder-sw.js";
/** Keeps the worker away from the rest of the site. */
export const SERVICE_WORKER_SCOPE = "/ship-builder";

function sameOrigin(urls: string[]): string[] {
  return urls.filter((url) => {
    try {
      return new URL(url).origin === window.location.origin;
    } catch {
      return false;
    }
  });
}

/** Same-origin resources this page has loaded, plus the page itself. */
function collectCacheUrls(): string[] {
  if (typeof performance.getEntriesByType !== "function") {
    return [window.location.href];
  }
  const resources = performance
    .getEntriesByType("resource")
    .map((entry) => entry.name);
  return [...sameOrigin(resources), window.location.href];
}

/**
 * Registers the offline service worker (production only) and asks it to cache
 * everything the page has already loaded, so one online visit is enough to
 * play offline. Failures are ignored: the game works fine online without it.
 */
export default function useServiceWorker(): void {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    let isCancelled = false;
    let worker: ServiceWorker | null = null;

    function postCacheUrls() {
      if (isCancelled || !worker) return;
      worker.postMessage({ type: "CACHE_URLS", urls: collectCacheUrls() });
    }

    // Resources that finish loading after the first message (such as the
    // lazily loaded 3D scene) are picked up by a second message on load...
    window.addEventListener("load", postCacheUrls);

    // ...and by an observer, for chunks that arrive after load but before the
    // worker controls the page (they would otherwise never be cached).
    let observer: PerformanceObserver | null = null;
    if (typeof window.PerformanceObserver === "function") {
      observer = new window.PerformanceObserver((list) => {
        if (isCancelled || !worker) return;
        const urls = sameOrigin(list.getEntries().map((entry) => entry.name));
        if (urls.length > 0) worker.postMessage({ type: "CACHE_URLS", urls });
      });
      try {
        observer.observe({ type: "resource", buffered: false });
      } catch {
        observer = null;
      }
    }

    async function register() {
      try {
        await navigator.serviceWorker.register(SERVICE_WORKER_URL, {
          scope: SERVICE_WORKER_SCOPE,
        });
        const registration = await navigator.serviceWorker.ready;
        worker = registration.active;
        postCacheUrls();
      } catch {
        // Offline support is best effort.
      }
    }
    void register();

    return () => {
      isCancelled = true;
      window.removeEventListener("load", postCacheUrls);
      observer?.disconnect();
    };
  }, []);
}
