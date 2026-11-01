"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { reloadPage } from "@/lib/update/reloadPage";

/** The registration is asked for a new worker at most this often. */
export const SW_UPDATE_INTERVAL_MS = 60_000;
/** If the waiting worker never takes over, reload anyway after this long. */
export const SW_TAKEOVER_TIMEOUT_MS = 3_000;

interface ServiceWorkerUpdateOptions {
  enabled: boolean;
  intervalMs?: number;
}

/**
 * Watches the page's service worker for a newer version.
 *
 * - Asks the browser for a fresh worker on load, when the tab returns and on
 *   `pageshow` (a pinned iOS app can sit open for days without a navigation,
 *   which is the only time the browser checks by itself).
 * - `isUpdateReady` turns true when a new worker is waiting, or when a new
 *   worker took over a page that was already controlled (its code is stale).
 * - `applyUpdate` tells a waiting worker to take over and reloads once the
 *   page's controller changes. It never reloads by itself: the caller only
 *   invokes it when the player taps.
 */
export function useServiceWorkerUpdate({
  enabled,
  intervalMs = SW_UPDATE_INTERVAL_MS,
}: ServiceWorkerUpdateOptions): {
  isUpdateReady: boolean;
  applyUpdate: () => void;
} {
  const [isUpdateReady, setIsUpdateReady] = useState(false);
  const waitingRef = useRef<ServiceWorker | null>(null);
  const isApplyingRef = useRef(false);
  const hasReloadedRef = useRef(false);

  const reloadOnce = useCallback(() => {
    if (hasReloadedRef.current) return;
    hasReloadedRef.current = true;
    reloadPage();
  }, []);

  useEffect(() => {
    if (!enabled || !("serviceWorker" in navigator)) return;
    const container = navigator.serviceWorker;
    // A first install is not an update: only a page that already had a
    // controller can be running old code.
    let hadController = !!container.controller;
    let isCancelled = false;
    let lastCheck = 0;
    let registration: ServiceWorkerRegistration | null = null;

    const markWaiting = (worker: ServiceWorker | null) => {
      if (isCancelled || !worker || !container.controller) return;
      waitingRef.current = worker;
      setIsUpdateReady(true);
    };

    const watchInstalling = () => {
      const installing = registration?.installing;
      if (!installing) return;
      installing.addEventListener("statechange", () => {
        if (installing.state === "installed")
          markWaiting(registration?.waiting ?? installing);
      });
    };

    const check = () => {
      const now = Date.now();
      if (lastCheck && now - lastCheck < intervalMs) return;
      lastCheck = now;
      // Offline or a failed fetch: stay quiet and try again later.
      registration?.update().catch(() => {});
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") check();
    };
    const handlePageShow = () => check();

    const handleControllerChange = () => {
      if (isApplyingRef.current) {
        reloadOnce();
        return;
      }
      // A new worker took over without being asked (it calls skipWaiting on
      // install): this page's code is now out of date.
      if (hadController) setIsUpdateReady(true);
      hadController = true;
    };

    container.addEventListener("controllerchange", handleControllerChange);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pageshow", handlePageShow);

    container.ready
      .then((ready) => {
        if (isCancelled) return;
        registration = ready;
        ready.addEventListener("updatefound", watchInstalling);
        markWaiting(ready.waiting);
        check();
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
      container.removeEventListener("controllerchange", handleControllerChange);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pageshow", handlePageShow);
      registration?.removeEventListener("updatefound", watchInstalling);
    };
  }, [enabled, intervalMs, reloadOnce]);

  const applyUpdate = useCallback(() => {
    const waiting = waitingRef.current;
    if (!waiting || waiting.state !== "installed") {
      reloadOnce();
      return;
    }
    isApplyingRef.current = true;
    waiting.postMessage({ type: "SKIP_WAITING" });
    // Safety net if the worker was already active and no change fires.
    setTimeout(reloadOnce, SW_TAKEOVER_TIMEOUT_MS);
  }, [reloadOnce]);

  return { isUpdateReady, applyUpdate };
}
