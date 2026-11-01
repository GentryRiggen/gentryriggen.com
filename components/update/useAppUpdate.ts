"use client";

import { useCallback } from "react";
import { useServiceWorkerUpdate } from "./useServiceWorkerUpdate";
import { useStaleChunkRecovery } from "./useStaleChunkRecovery";
import { useUpdateCheck } from "./useUpdateCheck";

interface AppUpdateOptions {
  versionUrl: string;
  /** Saves the game; runs before every reload this hook causes. */
  saveNow: () => void;
  /** Whether a service worker controls this game (production only). */
  isServiceWorkerEnabled?: boolean;
}

/**
 * Everything a service-worker game needs to always reach the newest version:
 * a version.json check, a service worker update check and stale-chunk
 * recovery. `update` is for the player's tap; nothing reloads on its own
 * mid-play except the stale-chunk case, where the page is already broken.
 */
export function useAppUpdate({
  versionUrl,
  saveNow,
  isServiceWorkerEnabled = isServiceWorkerActive(),
}: AppUpdateOptions): { isUpdateReady: boolean; update: () => void } {
  const versionCheck = useUpdateCheck({ versionUrl });
  const worker = useServiceWorkerUpdate({ enabled: isServiceWorkerEnabled });
  useStaleChunkRecovery(saveNow);

  const { applyUpdate } = worker;
  const update = useCallback(() => {
    saveNow();
    applyUpdate();
  }, [saveNow, applyUpdate]);

  return {
    isUpdateReady: versionCheck.isUpdateReady || worker.isUpdateReady,
    update,
  };
}

/** Matches the game's own registration rule: real builds only, no e2e. */
function isServiceWorkerActive(): boolean {
  return (
    process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_E2E !== "1"
  );
}
