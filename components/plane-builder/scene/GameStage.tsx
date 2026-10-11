"use client";

import { LEVELS } from "@/lib/plane-builder/levels";
import { usePlaneBuilderStore } from "@/lib/plane-builder/state/store";
import HangarScene from "./HangarScene";
import Stage from "./Stage";
import WorldScene from "./WorldScene";

/**
 * The 3D layer: the hangar turntable on the level and hangar screens, the
 * level's world on launch, flight and results. Reads everything from the store.
 */
export default function GameStage() {
  const screen = usePlaneBuilderStore((s) => s.screen);
  const levelId = usePlaneBuilderStore((s) => s.levelId);
  const tiers = usePlaneBuilderStore((s) => s.progress.levels[s.levelId].tiers);
  const level = LEVELS[levelId];
  const isHangar = screen === "levels" || screen === "hangar";

  return (
    <Stage>
      {isHangar ? (
        <HangarScene key={levelId} level={level} tiers={tiers} />
      ) : (
        <WorldScene key={levelId} level={level} tiers={tiers} screen={screen} />
      )}
    </Stage>
  );
}
