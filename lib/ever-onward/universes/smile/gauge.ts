import type { GaugeView, RunState } from "../../engine/types";
import { isWorldOpen, realOf } from "./world";
import { grumpyCount, isTownOpen, townMood } from "./town";

/** The town's mood or the world's real smiles, kept on the HUD. */
export function smileGauge(run: RunState): GaugeView | null {
  if (run.complete) return null;
  if (isTownOpen(run)) {
    const mood = townMood(run);
    const grumpy = grumpyCount(run) > 0;
    return {
      label: "MOOD",
      current: mood,
      max: 1,
      isLow: grumpy || mood < 0.4,
      isCritical: grumpy && mood < 0.25,
      display: `${Math.round(mood * 100)}%`,
      status: grumpy ? "GRUMPY" : "",
    };
  }
  if (!isWorldOpen(run)) return null;
  const real = realOf(run);
  return {
    label: "REAL",
    current: real,
    max: 1,
    isLow: real < 0.4,
    isCritical: real < 0.15,
    display: `${Math.round(real * 100)}%`,
    status: real < 0.4 ? "PAINTED" : "",
  };
}
