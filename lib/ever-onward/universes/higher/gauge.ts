import type { GaugeView, RunState } from "../../engine/types";
import { WOBBLE_AT } from "./alerts";
import {
  isPlayroomOpen,
  playroomLean,
  streakOf,
  toddlerStage,
} from "./playroom";
import {
  FORECAST_NAMES,
  STRAINS,
  forecastOf,
  isBlowing,
  isNoCrane,
  isSkyOpen,
  isSecured,
  ncLeft,
  strainStep,
} from "./sky";
import { hasSway, isWobbly, swayOf } from "./sway";

/** How far the tower leans, kept on the HUD so the lean is never a surprise. */
export function higherGauge(run: RunState): GaugeView | null {
  if (run.complete) return null;
  if (isPlayroomOpen(run)) {
    const lean = playroomLean(run);
    const streak = streakOf(run);
    return {
      label: "LEAN",
      current: lean,
      max: 1,
      isLow: lean >= 0.35,
      isCritical: lean >= 0.7 || toddlerStage(run) === "stomping",
      display: `${Math.round(lean * 100)}%`,
      status: streak > 0 ? `STREAK ${streak}` : "",
    };
  }
  if (isSkyOpen(run)) {
    const wx = isBlowing(run) ? 2 : forecastOf(run);
    return {
      label: "WIND",
      current: wx,
      max: 2,
      isLow: wx >= 1,
      isCritical: wx >= 2,
      display: isBlowing(run) ? "GUST" : FORECAST_NAMES[wx].toUpperCase(),
      status: isNoCrane(run)
        ? `NO CRANE ${ncLeft(run)}s`
        : isSecured(run)
          ? "TIED DOWN"
          : STRAINS[strainStep(run)].name.toUpperCase(),
    };
  }
  if (!hasSway(run)) return null;
  const sway = swayOf(run);
  const wobbling = sway >= WOBBLE_AT;
  return {
    label: "LEAN",
    current: sway,
    max: 1,
    isLow: isWobbly(run),
    isCritical: wobbling,
    display: `${Math.round(sway * 100)}%`,
    status: wobbling ? "WOBBLY" : isWobbly(run) ? "LEANS" : "",
  };
}
