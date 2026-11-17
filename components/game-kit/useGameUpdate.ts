"use client";

import { useAppUpdate } from "@/components/update/useAppUpdate";

interface GameUpdateOptions {
  /** Saves the game; runs before the reload the player's tap causes. */
  saveNow: () => void;
  /**
   * True when the game also runs `useGameServiceWorker`: a waiting or newly
   * activated worker then raises the update pill too, and the tap lets it
   * take over before reloading.
   */
  serviceWorker?: boolean;
}

/**
 * Update handling for a game: polls `/<slug>/version.json` (every 60 s while
 * visible, since an idle iPad fires no visibility events, 846091b7), recovers
 * from a stale chunk after a deploy and, with `serviceWorker`, watches the
 * game's worker for a newer version. `update` is for the player's tap on
 * <UpdatePill>; nothing reloads on its own mid-play.
 */
export function useGameUpdate(
  slug: string,
  { saveNow, serviceWorker = false }: GameUpdateOptions
): { isUpdateReady: boolean; update: () => void } {
  return useAppUpdate({
    versionUrl: `/${slug}/version.json`,
    saveNow,
    // undefined = the default rule: real builds only, never in e2e.
    isServiceWorkerEnabled: serviceWorker ? undefined : false,
  });
}
