import type { GaugeView, RunState } from "../../engine/types";
import { hasMeter, heatOf, isTired } from "./meter";

/** The cheer meter, kept on the HUD: it fills as the crowd tires. */
export function smileGauge(run: RunState): GaugeView | null {
  if (run.complete || !hasMeter(run)) return null;
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
