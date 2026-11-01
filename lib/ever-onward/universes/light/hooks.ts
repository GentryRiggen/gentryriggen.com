import type { ConsumableDef, RunState } from "../../engine/types";
import { sceneInfo } from "./scene";
import {
  gridSteadiness,
  headingOf,
  isCourseAuto,
  isCourseInPlay,
  isFlareOn,
  isGridAuto,
  isBoatOut,
  isGridInPlay,
  flameFraction,
  isOilCheap,
  isRushOn,
  isStorming,
  level,
  tankCapacity,
} from "./tick";
import { cloneRun } from "../../engine/engine";
import { TIDE_ACTION_IDS, haulsSoFar, isTideOpen, withoutTide } from "./tide";
import { SHIELD_ACTION_IDS, isWeatherOpen, withoutStorms } from "./weather";

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
    // Offered once the second catch is in (so it is not a crowd of beats at
    // the moment the clock opens).
    if (isTideOpen(run) && haulsSoFar(run) >= 2) plates.push("tide");
  } else if (run.phase === 1) {
    plates.push("crank");
    if (isGridInPlay(run) && !isGridAuto(run) && gridSteadiness(run) < 85)
      plates.push("grid");
    if (isRushOn(run)) plates.push("rush");
    // Offered once the first front has come and gone (so it is not a crowd of
    // beats at the moment the desk opens).
    if (isWeatherOpen(run) && (run.resources.wxFronts ?? 0) >= 1)
      plates.push("weather");
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
    if (isBoatOut(run)) plates.push("boat");
  }
  return plates;
}

/** Plates that need the player's hands count only while they are tended. */
export const PLATE_ACTIONS: Readonly<Record<string, readonly string[]>> = {
  oilMarket: ["buy-oil"],
  grid: ["balance-grid"],
  rush: ["ride-rush"],
  tide: TIDE_ACTION_IDS,
  weather: SHIELD_ACTION_IDS,
  course: ["correct-course"],
  flare: ["catch-flare"],
  boat: ["steer-boat", "flash-lamp"],
};

export const LIGHT_CONSUMABLES: readonly ConsumableDef[] = [
  {
    id: "flame",
    label: "The flame",
    level: (run) => (run.phase === 3 ? flameFraction(run) : null),
    // Low is when the lantern is dim and the light lets go slowly.
    lowZone: { lo: 0.02, hi: 0.3 },
  },
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
    // Cities visibly pay less under 50%: that is where a player acts.
    lowZone: { lo: 0.05, hi: 0.5 },
  },
  {
    id: "heading",
    label: "Probe heading",
    level: (run) =>
      isCourseInPlay(run) && !isCourseAuto(run)
        ? Math.min(1, Math.max(0, headingOf(run) / 100))
        : null,
    lowZone: { lo: 0.05, hi: 0.5 },
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
    s.letGoMask,
    // every chain step and generator now draws something
    s.wickTier,
    s.feesTier,
    s.dockTier,
    s.tankTier,
    s.trainTier,
    s.shuttersTier,
    s.contract,
    s.crankLevel,
    s.gen1,
    s.gen2,
    s.gen3,
    s.gen4,
    s.linesTier,
    s.subsTier,
    s.bulbsTier,
    s.gridTier,
    s.stormCrews,
    s.tideOpen,
    s.biggerNets,
    s.tideMill,
    s.weatherVane,
    s.aimLevel,
    s.mirrorTier,
    s.copyTier,
    s.relayTier,
    s.navTier,
    s.enginesTier,
    s.appetiteTier,
    s.boatVisible,
    s.finished,
    Math.floor(s.cities),
    Math.round(s.powered * 20),
  ].join("|");
}

export const lightSceneDiff = (before: RunState, after: RunState): boolean =>
  sceneKey(before) !== sceneKey(after);

/** Income probes see the run with no storm landing and no surge pending. */
export const lightIncomeView = (run: RunState): RunState => {
  const draft = isWeatherOpen(run) || isTideOpen(run) ? cloneRun(run) : run;
  if (isWeatherOpen(draft)) withoutStorms(draft);
  if (isTideOpen(draft)) withoutTide(draft);
  return draft;
};
