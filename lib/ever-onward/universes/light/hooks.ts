import type { ConsumableDef, RunState } from "../../engine/types";
import { sceneInfo } from "./scene";
import {
  gridSteadiness,
  headingOf,
  isCourseAuto,
  isCourseInPlay,
  isFlareOn,
  isGridAuto,
  isGridInPlay,
  isOilCheap,
  isRushOn,
  isStorming,
  level,
  tankCapacity,
} from "./tick";

/**
 * Scorecard hooks: what the simulator reads to count plates, watch the oil
 * tank and tell whether a purchase changed the scene. Nothing here changes
 * how the game plays.
 */

const OIL_LOW_SHARE = 0.4;

/** Systems that currently offer or want the player's attention. */
export function lightPlates(run: RunState): string[] {
  const plates: string[] = [];
  if (run.phase === 0) {
    plates.push("tap");
    const hasOilButton = run.resources.ships >= 12;
    const isTankLow =
      run.resources.oil < tankCapacity(run) * OIL_LOW_SHARE ||
      run.resources.oil <= 0;
    if (hasOilButton && (isOilCheap(run) || isTankLow))
      plates.push("oilMarket");
    if (isStorming(run)) plates.push("storm");
  } else if (run.phase === 1) {
    plates.push("crank");
    if (isGridInPlay(run) && !isGridAuto(run) && gridSteadiness(run) < 85)
      plates.push("grid");
    if (isRushOn(run)) plates.push("rush");
  } else if (run.phase === 2) {
    plates.push("aim");
    if (isCourseInPlay(run) && !isCourseAuto(run) && headingOf(run) < 85)
      plates.push("course");
    if (isFlareOn(run)) plates.push("flare");
  } else {
    plates.push("tend");
    const hasLetGoOnOffer = run.revealed.some(
      (id) => id.startsWith("letgo-") && level(run, id) === 0
    );
    if (hasLetGoOnOffer) plates.push("letGo");
  }
  return plates;
}

export const LIGHT_CONSUMABLES: readonly ConsumableDef[] = [
  {
    id: "oil",
    label: "Lamp oil",
    level: (run) =>
      run.phase === 0
        ? Math.min(1, Math.max(0, run.resources.oil / tankCapacity(run)))
        : null,
  },
  {
    id: "grid",
    label: "Grid steadiness",
    level: (run) =>
      isGridInPlay(run) && !isGridAuto(run)
        ? Math.min(1, Math.max(0, gridSteadiness(run) / 100))
        : null,
    // Cities visibly pay less under 60%: that is where a player acts.
    lowZone: { lo: 0.05, hi: 0.6 },
  },
  {
    id: "heading",
    label: "Probe heading",
    level: (run) =>
      isCourseInPlay(run) && !isCourseAuto(run)
        ? Math.min(1, Math.max(0, headingOf(run) / 100))
        : null,
    lowZone: { lo: 0.05, hi: 0.6 },
  },
];

/** The parts of the scene that change when something is built or let go. */
function sceneKey(run: RunState): string {
  const s = sceneInfo(run);
  return [
    s.lighthouses,
    s.lensLevel,
    s.keepers,
    s.generators,
    s.collectors,
    s.probes,
    s.lightsRemaining,
    s.remembered,
    Math.floor(s.cities),
    Math.round(s.powered * 20),
  ].join("|");
}

export const lightSceneDiff = (before: RunState, after: RunState): boolean =>
  sceneKey(before) !== sceneKey(after);
