"use client";

import { useCallback, useEffect, useState } from "react";
import { reloadPage } from "@/lib/jim/reload";
import {
  RETRY_AFTER_FAILURE_MS,
  activateWaitingWorker,
  watchForWaitingWorker,
} from "@/lib/jim/serviceWorkerUpdate";

const VERSION_URL = "/jim/version.json";
/** The version file and the worker are checked at most this often. */
export const JIM_UPDATE_CHECK_INTERVAL_MS = 60_000;

/** This build's id (see next.config.ts); undefined when it is not known. */
const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID;

/** Only real builds check: dev servers and e2e runs never see an update. */
const IS_ENABLED_BY_DEFAULT =
  process.env.NODE_ENV === "production" &&
  !process.env.NEXT_PUBLIC_E2E &&
  !!BUILD_ID &&
  BUILD_ID !== "dev";

interface JimUpdateOptions {
  /** The build id this page is running. */
  current?: string;
  enabled?: boolean;
  intervalMs?: number;
  /** Runs just before a tap reloads the page (to keep a draft). */
  onBeforeUpdate?: () => void;
}

async function fetchBuildId(): Promise<string | null> {
  try {
    const response = await fetch(VERSION_URL, { cache: "no-store" });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    if (typeof data !== "object" || data === null || !("build" in data))
      return null;
    return typeof data.build === "string" ? data.build : null;
  } catch {
    // Offline or a bad response: stay quiet and check again later.
    return null;
  }
}

/**
 * Tells the page when a newer Jim is ready: a different build id in
 * /jim/version.json, or a new service worker waiting. Checks on load and
 * whenever the app comes back into view (at most once a minute) and never
 * reloads by itself; `update` is for the tap.
 */
export default function useJimUpdate({
  current = BUILD_ID,
  enabled = IS_ENABLED_BY_DEFAULT,
  intervalMs = JIM_UPDATE_CHECK_INTERVAL_MS,
  onBeforeUpdate,
}: JimUpdateOptions = {}): { isUpdateReady: boolean; update: () => void } {
  const [isUpdateReady, setIsUpdateReady] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const stopWorker = watchForWaitingWorker(
      () => setIsUpdateReady(true),
      intervalMs
    );
    if (!current) return stopWorker;
    let lastCheck = 0;
    let isChecking = false;
    let isCancelled = false;

    const check = async () => {
      const now = Date.now();
      if (isChecking || (lastCheck && now - lastCheck < intervalMs)) return;
      isChecking = true;
      const latest = await fetchBuildId();
      isChecking = false;
      // A failed check may try again soon, not after a whole interval.
      lastCheck =
        latest === null
          ? Date.now() - Math.max(0, intervalMs - RETRY_AFTER_FAILURE_MS)
          : Date.now();
      if (!isCancelled && latest !== null && latest !== current)
        setIsUpdateReady(true);
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void check();
    };
    // iOS home-screen apps resume from the back-forward cache with a
    // `pageshow` and may skip `visibilitychange`.
    const handlePageShow = () => void check();

    void check();
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      isCancelled = true;
      stopWorker();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [current, enabled, intervalMs]);

  const update = useCallback(() => {
    onBeforeUpdate?.();
    const reload = reloadPage;
    // A waiting worker takes over first (its controllerchange reloads);
    // with none, a plain reload fetches the new page.
    void activateWaitingWorker(reload).then((hasWaiting) => {
      if (!hasWaiting) reload();
    });
  }, [onBeforeUpdate]);

  return { isUpdateReady, update };
}
