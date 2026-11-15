"use client";

import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import {
  advanceDeathLabels,
  deathLabelEls,
  deathLabels,
} from "@/lib/planet-smasher/deathLabels";
import { stepDt } from "@/lib/planet-smasher/fxClock";
import { useGameStore } from "@/lib/planet-smasher/store";
import { hideDeathLabel, paintDeathLabel } from "../ui/DeathLabels";

const tmp = new Vector3();

/** Projects each live death label onto the screen, once per frame. */
export default function DeathLabelDriver() {
  useFrame(({ camera, size }, delta) => {
    advanceDeathLabels(stepDt(delta));
    const playing = useGameStore.getState().phase === "playing";
    for (let i = 0; i < deathLabels.length; i++) {
      const el = deathLabelEls[i];
      if (!el) continue;
      const l = deathLabels[i];
      if (!l.active || !playing) {
        if (el.style.opacity !== "0") hideDeathLabel(el);
        continue;
      }
      // Past the horizon of the unit planet the point faces away: hide it.
      const { x, y, z } = camera.position;
      if (l.dir.x * x + l.dir.y * y + l.dir.z * z < 1) {
        if (el.style.opacity !== "0") hideDeathLabel(el);
        continue;
      }
      tmp.set(l.dir.x, l.dir.y, l.dir.z).project(camera);
      paintDeathLabel(
        el,
        l,
        (tmp.x * 0.5 + 0.5) * size.width,
        (-tmp.y * 0.5 + 0.5) * size.height
      );
    }
  });
  return null;
}
