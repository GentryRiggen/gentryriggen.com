import type { GaugeView, RunState } from "../../engine/types";
import { hasMeter, heatOf, isTired } from "./meter";
import { grumpyCount, isTownOpen, townMood } from "./town";

/** The town's mood or the world's cheer meter, kept on the HUD. */
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
  if (!hasMeter(run)) return null;
  const heat = heatOf(run);
  const tired = isTired(run);
  return {
    label: "CHEER",
    current: heat,
    max: 1,
    isLow: tired || heat >= 0.7,
    isCritical: tired || heat >= 0.9,
    display: `${Math.round(heat * 100)}%`,
    status: tired ? "TIRED" : heat >= 0.7 ? "WARM" : "",
  };
}
