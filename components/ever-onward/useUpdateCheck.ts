"use client";

import { useEffect, useState } from "react";

const VERSION_URL = "/ever-onward/version.json";
/** The version file is fetched at most this often. */
export const UPDATE_CHECK_INTERVAL_MS = 60_000;

/** This build's id (see next.config.ts); undefined when it is not known. */
const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID;

/** Only real builds check: dev servers and e2e runs never see an update. */
const IS_ENABLED_BY_DEFAULT =
  process.env.NODE_ENV === "production" &&
  !process.env.NEXT_PUBLIC_E2E &&
  !!BUILD_ID &&
  BUILD_ID !== "dev";

interface UpdateCheckOptions {
  /** The build id this page is running. */
  current?: string;
  enabled?: boolean;
  intervalMs?: number;
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
 * Tells the page when a newer build has been deployed. It checks on load
 * and whenever the tab comes back into view (at most once a minute), and
 * never reloads anything itself.
 */
export function useUpdateCheck({
  current = BUILD_ID,
  enabled = IS_ENABLED_BY_DEFAULT,
  intervalMs = UPDATE_CHECK_INTERVAL_MS,
}: UpdateCheckOptions = {}): { isUpdateReady: boolean } {
  const [isUpdateReady, setIsUpdateReady] = useState(false);

  useEffect(() => {
    if (!enabled || !current) return;
    let lastCheck = 0;
    let isCancelled = false;

    const check = async () => {
      const now = Date.now();
      if (lastCheck && now - lastCheck < intervalMs) return;
      lastCheck = now;
      const latest = await fetchBuildId();
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
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [current, enabled, intervalMs]);

  return { isUpdateReady };
}
