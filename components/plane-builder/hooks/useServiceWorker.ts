"use client";

import { useEffect } from "react";
import { PLANE_MODEL_PATHS } from "@/lib/plane-builder/offline/modelPaths";

export const SERVICE_WORKER_URL = "/plane-builder-sw.js";
/**
 * Keeps the worker away from the rest of the site. No trailing slash on
 * purpose: the game lives at "/plane-builder" itself, which a scope of
 * "/plane-builder/" would not cover.
 */
export const SERVICE_WORKER_SCOPE = "/plane-builder";

function sameOrigin(urls: string[]): string[] {
  return urls.filter((url) => {
    try {
      return new URL(url).origin === window.location.origin;
    } catch {
      return false;
    }
  });
}

/** Same-origin resources this page has loaded, plus the page and every model. */
function collectCacheUrls(): string[] {
  const models = PLANE_MODEL_PATHS.map(
    (path) => `${window.location.origin}${path}`
  );
  if (typeof performance.getEntriesByType !== "function") {
    return [window.location.href, ...models];
  }
  const resources = performance
    .getEntriesByType("resource")
    .map((entry) => entry.name);
  return [...sameOrigin(resources), window.location.href, ...models];
}

/**
 * Registers the offline service worker (production only) and asks it to cache
 * everything the page has already loaded, so one online visit is enough to
 * play offline. Failures are ignored: the game works fine online without it.
 */
export default function useServiceWorker(): void {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    // The e2e build is a production build; keep its pages out of the cache
    // unless a test opts in with ?offline (the offline spec does).
    if (
      process.env.NEXT_PUBLIC_E2E === "1" &&
      !new URLSearchParams(window.location.search).has("offline")
    ) {
      return;
    }
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
