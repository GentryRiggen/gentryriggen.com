import { resolveAttachPoint } from "./attach";
import { getPartDef } from "./catalog";
import { hullSpeedModifier } from "./hullEnds";
import {
  beamOf,
  buildOccupancy,
  gridLength,
  partCells,
  type Occupancy,
} from "./grid";
import type { PlacedPart, Ship } from "./types";

// Tunable constants — see the plan's calibration table.
export const CREW_PER_SEGMENT = 60;
export const HULL_DEPTH = 4;
export const GRT_PER_UNIT = 63;
export const SPEED = {
  base: 14,
  perPower: 1.5,
  powerPerProp: 2,
  perSegment: 0.25,
  lossPer10kTons: 1,
  min: 8,
  max: 30,
};
export const HULL_MASS_PER_CELL = 1;
export const HULL_CENTROID_Y = -1;
export const STABILITY_THRESHOLDS = { topHeavy: 0.15, dangerous: 0.3 };

export const TITANIC_REFERENCE = {
  grossTonnage: 46328,
  topSpeedKnots: 21,
  lifeboats: 20,
  lifeboatSeats: 1178,
  peopleAboard: 2224,
};

export type CoverageLevel = "red" | "amber" | "green";
export type Stability = "Stable" | "Top-heavy" | "Dangerous";
export type WarningCode =
  | "lifeboats"
  | "no-bridge"
  | "no-funnels"
  | "no-propellers"
  | "needs-propellers"
  | "top-heavy";

export interface StatWarning {
  code: WarningCode;
  message: string;
}

export interface Stats {
  passengers: { first: number; second: number; third: number; total: number };
  crew: number;
  peopleAboard: number;
  lifeboats: number;
  lifeboatSeats: number;
  coverage: number;
  coverageLevel: CoverageLevel;
  grossTonnage: number;
  topSpeedKnots: number;
  stability: Stability;
  stabilityRatio: number;
  warnings: StatWarning[];
}

export function coverageLevel(coverage: number): CoverageLevel {
  if (coverage < 0.5) return "red";
  if (coverage < 1) return "amber";
  return "green";
}

function partBaseY(ship: Ship, part: PlacedPart, occupancy: Occupancy): number {
  if (part.anchor.kind === "grid") return part.anchor.level;
  return resolveAttachPoint(ship, part.anchor, occupancy)?.position.y ?? 0;
}

export function computeSpeed(
  power: number,
  propellers: number,
  segments: number,
  grossTonnage: number,
  /** Knots from the hull's bow and stern, applied before the clamp. */
  hullModifier = 0
): number {
  if (power === 0 || propellers === 0) return 0;
  const usable = Math.min(power, propellers * SPEED.powerPerProp);
  const raw =
    SPEED.base +
    usable * SPEED.perPower +
    segments * SPEED.perSegment -
    (grossTonnage / 10000) * SPEED.lossPer10kTons +
    hullModifier;
  const clamped = Math.min(SPEED.max, Math.max(SPEED.min, raw));
  return Math.round(clamped * 10) / 10;
}

function classifyStability(ratio: number): Stability {
  if (ratio >= STABILITY_THRESHOLDS.dangerous) return "Dangerous";
  if (ratio >= STABILITY_THRESHOLDS.topHeavy) return "Top-heavy";
  return "Stable";
}

export function computeStats(ship: Ship): Stats {
  const occupancy = buildOccupancy(ship);
  const length = gridLength(ship);
  const beam = beamOf(ship);
  const passengers = { first: 0, second: 0, third: 0, total: 0 };
  let lifeboats = 0;
  let lifeboatSeats = 0;
  let stokers = 0;
  let funnels = 0;
  let power = 0;
  let propellers = 0;
  let bridges = 0;
  let blockCells = 0;

  const hullMass = length * beam * HULL_MASS_PER_CELL;
  let mass = hullMass;
  let moment = hullMass * HULL_CENTROID_Y;

  for (const part of ship.parts) {
    const def = getPartDef(part.type);
    const cells = partCells(part).length;
    blockCells += cells;
    if (def.passengers) {
      passengers[def.passengers.cabinClass] += def.passengers.count * cells;
    }
    if (def.seats) {
      lifeboats += 1;
      lifeboatSeats += def.seats;
    }
    if (def.stokers) stokers += def.stokers;
    if (def.power) {
      funnels += 1;
      power += def.power;
    }
    if (part.type === "propeller") propellers += 1;
    if (def.placement === "grid" && def.role === "bridge") bridges += 1;

    const partMass = def.placement === "grid" ? def.mass * cells : def.mass;
    mass += partMass;
    moment += partMass * (partBaseY(ship, part, occupancy) + def.height / 2);
  }

  passengers.total = passengers.first + passengers.second + passengers.third;
  const crew = ship.hull.lengthSegments * CREW_PER_SEGMENT + stokers;
  const peopleAboard = passengers.total + crew;
  const coverage = peopleAboard > 0 ? lifeboatSeats / peopleAboard : 1;
  const grossTonnage = Math.round(
    (length * beam * HULL_DEPTH + blockCells) * GRT_PER_UNIT
  );
  const topSpeedKnots = computeSpeed(
    power,
    propellers,
    ship.hull.lengthSegments,
    grossTonnage,
    hullSpeedModifier(ship.hull.bow, ship.hull.stern)
  );
  const stabilityRatio = moment / mass / beam;
  const stability = classifyStability(stabilityRatio);

  const warnings: StatWarning[] = [];
  if (coverage < 1) {
    warnings.push({
      code: "lifeboats",
      message: `Lifeboats seat ${lifeboatSeats.toLocaleString("en-US")} of ${peopleAboard.toLocaleString("en-US")} aboard (${(peopleAboard - lifeboatSeats).toLocaleString("en-US")} short)`,
    });
  }
  if (bridges === 0) {
    warnings.push({
      code: "no-bridge",
      message: "No bridge — someone has to steer",
    });
  }
  if (funnels === 0) {
    warnings.push({
      code: "no-funnels",
      message: "No funnels — she isn't going anywhere",
    });
  }
  if (funnels > 0 && propellers === 0) {
    warnings.push({
      code: "no-propellers",
      message: "No propellers — she can't move",
    });
  } else if (propellers > 0 && power > propellers * SPEED.powerPerProp) {
    warnings.push({
      code: "needs-propellers",
      message: "Not enough propellers for your funnels",
    });
  }
  if (stability !== "Stable") {
    warnings.push({
      code: "top-heavy",
      message:
        stability === "Dangerous"
          ? "Dangerously top-heavy — she'll capsize"
          : "Top-heavy — lower the superstructure, or widen or lengthen the hull",
    });
  }

  return {
    passengers,
    crew,
    peopleAboard,
    lifeboats,
    lifeboatSeats,
    coverage,
    coverageLevel: coverageLevel(coverage),
    grossTonnage,
    topSpeedKnots,
    stability,
    stabilityRatio,
    warnings,
  };
}
