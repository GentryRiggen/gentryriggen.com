"use client";

import { useCallback } from "react";
import { reloadPage } from "@/lib/update/reloadPage";
import { useStaleChunkRecovery } from "@/components/update/useStaleChunkRecovery";
import { useUpdateCheck } from "@/components/update/useUpdateCheck";

interface GameUpdateOptions {
  /** Saves the game; runs before the reload the player's tap causes. */
  saveNow: () => void;
}

/**
 * Update handling for a game without a service worker: polls
 * `/<slug>/version.json` (every 60 s while visible, since an idle iPad fires
 * no visibility events, 846091b7) and recovers from a stale chunk after a
 * deploy. `update` is for the player's tap on <UpdatePill>; nothing reloads
 * on its own mid-play.
 */
export function useGameUpdate(
  slug: string,
  { saveNow }: GameUpdateOptions
): { isUpdateReady: boolean; update: () => void } {
  const { isUpdateReady } = useUpdateCheck({
    versionUrl: `/${slug}/version.json`,
  });
  useStaleChunkRecovery(saveNow);
  const update = useCallback(() => {
    saveNow();
    reloadPage();
  }, [saveNow]);
  return { isUpdateReady, update };
}
