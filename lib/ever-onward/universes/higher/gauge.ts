import type { GaugeView, RunState } from "../../engine/types";
import { WOBBLE_AT } from "./alerts";
import { hasSway, isWobbly, swayOf } from "./sway";

/** How far the tower leans, kept on the HUD so Steady is never a surprise. */
export function higherGauge(run: RunState): GaugeView | null {
  if (run.complete || !hasSway(run)) return null;
  const sway = swayOf(run);
  const wobbling = sway >= WOBBLE_AT;
  return {
    label: "SWAY",
    current: sway,
    max: 1,
    isLow: isWobbly(run),
    isCritical: wobbling,
    display: `${Math.round(sway * 100)}%`,
    status: wobbling ? "WOBBLY" : isWobbly(run) ? "LEANS" : "",
  };
}
