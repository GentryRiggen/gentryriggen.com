"use client";

import { useEffect } from "react";
import { gameIconPaths } from "@/lib/game-kit/metadata";

interface GameServiceWorkerOptions {
  /** Must match the `iconVersion` the page's metadata uses. */
  iconVersion?: number;
}

/** The worker's URL: `public/<slug>-sw.js`, generated from the shared template. */
export function serviceWorkerUrl(slug: string): string {
  return `/${slug}-sw.js`;
}

/**
 * The scope has no trailing slash on purpose: the game lives at "/<slug>"
 * itself, which a scope of "/<slug>/" would not cover. It also keeps the
 * worker away from the rest of the site.
 */
export function serviceWorkerScope(slug: string): string {
  return `/${slug}`;
}

/** Whether a game's worker may run in this build (see useGameServiceWorker). */
function isServiceWorkerAllowed(): boolean {
  if (process.env.NODE_ENV !== "production") return false;
  // The e2e build is a production build; keep its pages out of the cache
  // unless a test opts in with ?offline (the offline specs do).
  return (
    process.env.NEXT_PUBLIC_E2E !== "1" ||
    new URLSearchParams(window.location.search).has("offline")
  );
}

function sameOrigin(urls: string[]): string[] {
  return urls.filter((url) => {
    try {
      return new URL(url).origin === window.location.origin;
    } catch {
      return false;
    }
  });
}

/** Same-origin resources this page has loaded, plus the page, manifest, icons. */
function collectCacheUrls(slug: string, iconVersion: number): string[] {
  const fixed = [
    window.location.href,
    `/${slug}.webmanifest`,
    ...Object.values(gameIconPaths(slug, iconVersion)),
  ].map((path) => new URL(path, window.location.origin).href);
  if (typeof performance.getEntriesByType !== "function") return fixed;
  const resources = performance
    .getEntriesByType("resource")
    .map((entry) => entry.name);
  return [...sameOrigin(resources), ...fixed];
}

/**
 * Registers a game's offline service worker (production only, never in the
 * e2e build unless the page has `?offline`) and asks it to cache everything
 * the page has loaded, so one online visit is enough to play offline.
 * Failures are ignored: the game works fine online without it.
 *
 * Pair it with `useGameUpdate(slug, { saveNow, serviceWorker: true })` so an
 * "update ready" pill still appears when a new worker or build is waiting.
 */
export function useGameServiceWorker(
  slug: string,
  { iconVersion = 1 }: GameServiceWorkerOptions = {}
): void {
  useEffect(() => {
    if (!isServiceWorkerAllowed()) return;
    if (!("serviceWorker" in navigator)) return;

    let isCancelled = false;
    let worker: ServiceWorker | null = null;

    function postCacheUrls() {
      if (isCancelled || !worker) return;
      worker.postMessage({
        type: "CACHE_URLS",
        urls: collectCacheUrls(slug, iconVersion),
      });
    }

    // Resources that finish loading after the first message are picked up by
    // a second message on load...
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
        await navigator.serviceWorker.register(serviceWorkerUrl(slug), {
          scope: serviceWorkerScope(slug),
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
  }, [slug, iconVersion]);
}
