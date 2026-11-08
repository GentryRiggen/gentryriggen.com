import type { ConsumableDef, RunState } from "../../engine/types";
import { sceneInfo } from "./scene";
import { LAMP_ACTION_IDS } from "./lamps";
import { BEAM_ACTION_IDS } from "./beam";
import {
  isBoatOut,
  isGridInPlay,
  flameFraction,
  isOilCheap,
  isBeamOpen,
  isLampsOpen,
  isStorming,
  level,
  tankCapacity,
} from "./tick";
import { trafficShare } from "./toll";
import { cloneRun } from "../../engine/engine";
import {
  DESIGN_ACTION_IDS,
  RECALL_ACTION,
  isDialsOpen,
  wildCount,
} from "./design";
import {
  DISTANCE_ACTION_IDS,
  flaresSoFar,
  flareSafety,
  forecastSize,
  withoutFlares,
} from "./sunEdge";
import { TOLL_ACTION_IDS, isTollOpen, tollLockLeft } from "./toll";
import { isTankerIn } from "./tanker";
import {
  GARDEN_ACTION_IDS,
  WATER_ACTION,
  isGardenOpen,
  picksSoFar,
  withoutGarden,
} from "./garden";
import {
  FUND_ACTION_IDS,
  FUND_CHOICE_IDS,
  fundBalance,
  isFundOpen,
} from "./fund";
import { FORK_ACTION_IDS, chosenSide, forkOf } from "./forks";
import { OVERDRIVE_ACTION, isOverdriveOn, isOverdriveOpen } from "./overdrive";
import {
  CREW_POST_ACTION_IDS,
  isCrewsOpen,
  isWeatherOpen,
  withoutStorms,
} from "./weather";
import {
  batteryCapacity,
  chargeShare01,
  isDusk,
  isRushNow,
  withoutEvenings,
} from "./grid";

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
    const hasOilButton = isBeamOpen(run);
    const isTankLow =
      run.resources.oil < tankCapacity(run) * OIL_LOW_SHARE ||
      run.resources.oil <= 0;
    if (hasOilButton && (isTankerIn(run) || isOilCheap(run) || isTankLow))
      plates.push("oilMarket");
    if (hasOilButton) plates.push("lamp");
    if (isStorming(run)) plates.push("storm");
    // The harbor desk wants a look while the sign is fresh or the ships are
    // off (a rival's change moves the traffic, so it is a plate then).
    if (isTollOpen(run) && (tollLockLeft(run) > 0 || trafficShare(run) < 0.7))
      plates.push("toll");
  } else if (run.phase === 1) {
    plates.push("crank");
    if (isLampsOpen(run)) plates.push("lamps");
    // Dusk and the rush: the streetlights are worth a look before it hits.
    if (isDusk(run) || isRushNow(run)) plates.push("evening");
    if (isCrewsOpen(run)) plates.push("crews");
    // Offered once the first front has come and gone (so it is not a crowd of
    // beats at the moment the desk opens).
    if (isWeatherOpen(run) && (run.resources.wxFronts ?? 0) >= 1)
      plates.push("weather");
  } else if (run.phase === 2) {
    plates.push("aim");
    // The design bench and the sun's edge want a look when a flare is
    // forecast or the fleet has strays (not at the moment they open).
    if (isDialsOpen(run) && flaresSoFar(run) >= 1) {
      plates.push("design");
      if (forecastSize(run) !== null) plates.push("flare");
      if (wildCount(run) >= 1) plates.push("wild");
    }
  } else {
    plates.push("tend");
    const hasLetGoOnOffer = run.revealed.some(
      (id) => id.startsWith("letgo-") && level(run, id) === 0
    );
    if (hasLetGoOnOffer) plates.push("letGo");
    if (isBoatOut(run)) plates.push("boat");
    // Offered once the second bloom is picked (so it is not a crowd of beats
    // at the moment the first seed is planted).
    if (isGardenOpen(run) && picksSoFar(run) >= 2) plates.push("garden");
  }
  if (isFundOpen(run) && fundBalance(run) > 0) plates.push("fund");
  const fork = forkOf(run);
  if (fork && fork.isOpen(run) && chosenSide(run, fork) === null)
    plates.push("fork");
  if (isOverdriveOpen(run) && isOverdriveOn(run)) plates.push("overdrive");
  return plates;
}

/** Plates that need the player's hands count only while they are tended. */
export const PLATE_ACTIONS: Readonly<Record<string, readonly string[]>> = {
  oilMarket: ["buy-oil"],
  lamps: LAMP_ACTION_IDS,
  evening: LAMP_ACTION_IDS,
  weather: CREW_POST_ACTION_IDS,
  crews: CREW_POST_ACTION_IDS,
  lamp: BEAM_ACTION_IDS,
  toll: TOLL_ACTION_IDS,
  design: DESIGN_ACTION_IDS,
  flare: DISTANCE_ACTION_IDS,
  wild: [RECALL_ACTION],
  boat: ["steer-boat", "flash-lamp"],
  garden: GARDEN_ACTION_IDS,
  fund: FUND_ACTION_IDS,
  overdrive: [OVERDRIVE_ACTION],
  fork: FORK_ACTION_IDS,
};

/**
 * Real choices, for the decision-gap metric: buying oil at a price, the
 * harbor toll, the probe design and the sun's edge, where the storm crews go, when to water.
 * Claims (the rush, a flare), fixes (balance, correct, steer) and collects
 * (pick) are not choices.
 */
export const LIGHT_DECISION_ACTIONS: readonly string[] = [
  "buy-oil",
  ...TOLL_ACTION_IDS,
  ...DESIGN_ACTION_IDS,
  ...DISTANCE_ACTION_IDS,
  RECALL_ACTION,
  ...CREW_POST_ACTION_IDS,
  WATER_ACTION,
  ...LAMP_ACTION_IDS,
  ...BEAM_ACTION_IDS,
  ...FUND_CHOICE_IDS,
  OVERDRIVE_ACTION,
  ...FORK_ACTION_IDS,
];

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
    label: "Battery charge",
    level: (run) =>
      isGridInPlay(run) && batteryCapacity(run) > 0 ? chargeShare01(run) : null,
    // Half full or less: the rush may find them short.
    lowZone: { lo: 0.05, hi: 0.5 },
  },
  {
    id: "fleet",
    label: "Flare safety",
    level: (run) =>
      isDialsOpen(run) && (run.resources.probes ?? 0) >= 4
        ? flareSafety(run)
        : null,
    // Flying close with thin shields: a flare would burn a lot of the fleet.
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
    s.batteries,
    s.gridOpen,
    s.crewBuild,
    s.crewSchool,
    s.weatherOpen,
    s.watch0,
    s.watch1,
    s.watch2,
    s.stormCrews,
    s.tollOpen,
    s.tollStep,
    s.dialsOpen,
    s.dsSpeed,
    s.dsMirrors,
    s.dsCopying,
    s.dsShields,
    s.wild,
    s.weatherVane,
    s.aimLevel,
    s.mirrorTier,
    s.copyTier,
    s.relayTier,
    s.navTier,
    s.enginesTier,
    s.appetiteTier,
    s.boatVisible,
    s.gardenCode,
    s.rainBarrel,
    s.finished,
    s.forkCoast,
    s.forkNight,
    s.forkSky,
    s.forkLast,
    s.windBuilt,
    Math.floor(s.cities),
    Math.round(s.powered * 20),
  ].join("|");
}

export const lightSceneDiff = (before: RunState, after: RunState): boolean =>
  sceneKey(before) !== sceneKey(after);

/** Income probes see the run with no storm landing and no surge pending. */
export const lightIncomeView = (run: RunState): RunState => {
  const draft =
    isOverdriveOn(run) ||
    isWeatherOpen(run) ||
    isGridInPlay(run) ||
    isDialsOpen(run) ||
    isGardenOpen(run)
      ? cloneRun(run)
      : run;
  // A minute of overdrive is a burst, not the income the scorecard measures.
  if (isOverdriveOn(draft)) draft.resources.odLeft = 0;
  if (isWeatherOpen(draft)) withoutStorms(draft);
  if (isGridInPlay(draft)) withoutEvenings(draft);
  if (isDialsOpen(draft)) withoutFlares(draft);
  if (isGardenOpen(draft)) withoutGarden(draft);
  return draft;
};
