import type { LevelId } from "@/lib/plane-builder/levels/types";
import type { Tiers } from "@/lib/plane-builder/plane/catalog";

/** What a plane looks like at a set of tiers; PlaneModel just draws it. */
export interface PlaneParts {
  /** Meadow's starter plane is a folded paper dart. */
  isDart: boolean;
  bodyLength: number;
  wingSpan: number;
  hasBiplane: boolean;
  /** Radians the wings sweep back (0 when straight). */
  sweep: number;
  propellers: 0 | 1 | 2;
  hasNacelles: boolean;
  hasAfterburner: boolean;
  hasTanks: boolean;
  hasStripes: boolean;
  isGold: boolean;
}

const BIPLANE_WINGS_TIER = 4;
const SWEPT_WINGS_TIER = 5;
const SWEEP_ANGLE = (30 * Math.PI) / 180;
const SECOND_PROPELLER_TIER = 6;
const AFTERBURNER_TIER = 7;
const TANKS_TIER = 3;
const STRIPES_TIER = 1;
const GOLD_TIER = 8;

function propellerCount(levelId: LevelId, engine: number): 0 | 1 | 2 {
  if (engine === 0 || levelId === "mountains") return 0;
  return levelId === "canyon" && engine >= SECOND_PROPELLER_TIER ? 2 : 1;
}

export function planeParts(levelId: LevelId, tiers: Tiers): PlaneParts {
  return {
    isDart: levelId === "meadow" && tiers.body === 0,
    bodyLength: 2 + 0.15 * tiers.body,
    wingSpan: 1.2 + 0.5 * tiers.wings,
    hasBiplane: levelId === "canyon" && tiers.wings >= BIPLANE_WINGS_TIER,
    sweep:
      levelId === "mountains" && tiers.wings >= SWEPT_WINGS_TIER
        ? SWEEP_ANGLE
        : 0,
    propellers: propellerCount(levelId, tiers.engine),
    hasNacelles: levelId === "mountains" && tiers.engine > 0,
    hasAfterburner: levelId === "mountains" && tiers.engine >= AFTERBURNER_TIER,
    hasTanks: tiers.fuel >= TANKS_TIER,
    hasStripes: tiers.multiplier >= STRIPES_TIER,
    isGold: tiers.multiplier >= GOLD_TIER,
  };
}
