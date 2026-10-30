"use client";

import type { Ghost } from "@/lib/plane-builder/ghost/ghost";
import { usePlaneBuilderStore } from "@/lib/plane-builder/state/store";
import { useGhostEnabled } from "../ui/ghostSetting";

/**
 * The ghost to race: today's best daily flight on the daily challenge, else
 * the world's best flight. Null when there is none or the player turned
 * ghosts off. The same object until a new best replaces it.
 */
export default function useActiveGhost(): Ghost | null {
  const isEnabled = useGhostEnabled();
  const ghost = usePlaneBuilderStore((s) => {
    if (s.daily) {
      const best = s.progress.dailyBest;
      return best?.date === s.daily.date ? best.ghost : null;
    }
    return s.progress.ghosts[s.levelId] ?? null;
  });
  return isEnabled ? ghost : null;
}
