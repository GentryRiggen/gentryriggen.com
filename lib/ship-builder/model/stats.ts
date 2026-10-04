import type { ShipKind } from "./kinds";
import { resolveAttachPoint } from "./attach";
import { getPartDef } from "./catalog";
import { hullSpeedModifier } from "./hullEnds";
import { compartmentSpecsOf } from "../sim/compartments";
import { occupancyOf } from "./occupancyCache";
import { beamOf, gridLength, partCells, type Occupancy } from "./grid";
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

/** How a ship's era turns power into speed. */
export interface Drivetrain {
  /** Power one propeller (or azipod) can use. */
  powerPerProp: number;
  /** Knots lost per 10,000 gross tons. */
  lossPer10kTons: number;
}

/**
 * Liners use 1910s steam engineering. Modern kinds have engines and
 * propellers that handle far more power, and hull shapes that lose much
 * less speed to size, so a giant cruise ship or box ship still makes about
 * 22 knots.
 */
export const DRIVETRAINS: Record<ShipKind, Drivetrain> = {
  liner: {
    powerPerProp: SPEED.powerPerProp,
    lossPer10kTons: SPEED.lossPer10kTons,
  },
  cruise: { powerPerProp: 5, lossPer10kTons: 0.5 },
  navy: { powerPerProp: 5, lossPer10kTons: 0.5 },
  cargo: { powerPerProp: 5, lossPer10kTons: 0.5 },
};
export const HULL_MASS_PER_CELL = 1;
export const HULL_CENTROID_Y = -1;
export const STABILITY_THRESHOLDS = { topHeavy: 0.15, dangerous: 0.3 };

/**
 * Side-to-side balance. The lateral offset of the centre of mass, as a share
 * of the beam, turns into a resting list: `LIST_GAIN` radians per unit of
 * offset share, amplified by top-heaviness (a tall ship leans further for the
 * same lopsidedness), then capped.
 */
export const LIST = {
  /** Offsets under this share of the beam are float noise: exactly level. */
  deadZone: 0.01,
  gain: 3,
  /** Extra lean per unit of stabilityRatio. */
  topHeavyGain: 2,
  /** Never lean past this (radians, 25 degrees). */
  maxAngle: (25 * Math.PI) / 180,
  /** Under this (radians, 1.5 degrees) the balance label reads Level. */
  levelAngle: (1.5 * Math.PI) / 180,
  /** The "Sits level" check fails from here (radians, 4 degrees). */
  checkAngle: (4 * Math.PI) / 180,
};

export const TITANIC_REFERENCE = {
  grossTonnage: 46328,
  topSpeedKnots: 21,
  lifeboats: 20,
  lifeboatSeats: 1178,
  peopleAboard: 2224,
};

export type CoverageLevel = "red" | "amber" | "green";
export type Stability = "Stable" | "Top-heavy" | "Dangerous";
export type Balance = "Level" | "Leans to port" | "Leans to starboard";
export type WarningCode =
  | "lifeboats"
  | "no-bridge"
  | "no-funnels"
  | "no-propellers"
  | "needs-propellers"
  | "no-rudder"
  | "crew-berths"
  | "top-heavy"
  | "lopsided";

export interface StatWarning {
  code: WarningCode;
  message: string;
}

/** One goal for a seaworthy ship: passing, or failing with a plain reason. */
export interface Check {
  /** Same codes as warnings: every failing check is exactly one warning. */
  code: WarningCode;
  /** Positive wording, e.g. "Bridge to steer from". */
  label: string;
  ok: boolean;
  /** What's wrong; only present while the check fails. */
  detail?: string;
}

export interface Stats {
  passengers: { first: number; second: number; third: number; total: number };
  crew: number;
  crewBerths: number;
  peopleAboard: number;
  lifeboats: number;
  lifeboatSeats: number;
  /** Container capacity in twenty-foot-equivalent units. */
  teu: number;
  coverage: number;
  coverageLevel: CoverageLevel;
  grossTonnage: number;
  topSpeedKnots: number;
  stability: Stability;
  stabilityRatio: number;
  /** Rooms the bulkheads divide the hull into: walls plus one. */
  watertightCompartments: number;
  /**
   * Resting list from off-centre weight, in radians. Positive leans to
   * starboard, negative to port; exactly 0 for a balanced ship.
   */
  listAngle: number;
  balance: Balance;
  /** Goals in build order. Only the ones that apply right now. */
  checks: Check[];
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

/**
 * Resting list for a lateral offset (cells toward port from the centreline).
 * Weight to port leans her to port, which is a negative angle.
 */
export function computeListAngle(
  lateralOffset: number,
  beam: number,
  stabilityRatio: number
): number {
  const share = Math.abs(lateralOffset) / beam;
  if (share < LIST.deadZone) return 0;
  const magnitude = Math.min(
    LIST.maxAngle,
    share * LIST.gain * (1 + Math.max(0, stabilityRatio) * LIST.topHeavyGain)
  );
  return lateralOffset > 0 ? -magnitude : magnitude;
}

function classifyBalance(listAngle: number): Balance {
  if (Math.abs(listAngle) < LIST.levelAngle) return "Level";
  return listAngle < 0 ? "Leans to port" : "Leans to starboard";
}

export function computeSpeed(
  power: number,
  propellers: number,
  segments: number,
  grossTonnage: number,
  /** Knots from the hull's bow and stern, applied before the clamp. */
  hullModifier = 0,
  drivetrain: Drivetrain = DRIVETRAINS.liner
): number {
  if (power === 0 || propellers === 0) return 0;
  const usable = Math.min(power, propellers * drivetrain.powerPerProp);
  const raw =
    SPEED.base +
    usable * SPEED.perPower +
    segments * SPEED.perSegment -
    (grossTonnage / 10000) * drivetrain.lossPer10kTons +
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
  const occupancy = occupancyOf(ship);
  const length = gridLength(ship);
  const beam = beamOf(ship);
  const passengers = { first: 0, second: 0, third: 0, total: 0 };
  let lifeboats = 0;
  let lifeboatSeats = 0;
  let stokers = 0;
  let teu = 0;
  let crewBerths = 0;
  let funnels = 0;
  let power = 0;
  let propellers = 0;
  let rudders = 0;
  let bridges = 0;
  let blockCells = 0;

  const hullMass = length * beam * HULL_MASS_PER_CELL;
  let mass = hullMass;
  let moment = hullMass * HULL_CENTROID_Y;
  // Model z grows from starboard to port; the hull itself is symmetric.
  const centreline = beam / 2;
  let lateralMoment = 0;

  for (const part of ship.parts) {
    const def = getPartDef(part.type);
    const footprint = partCells(part);
    const cells = footprint.length;
    blockCells += cells;
    if (def.passengers) {
      passengers[def.passengers.cabinClass] += def.passengers.count * cells;
    }
    if (def.crewBerths) crewBerths += def.crewBerths * cells;
    if (def.seats) {
      lifeboats += 1;
      lifeboatSeats += def.seats;
    }
    if (def.stokers) stokers += def.stokers;
    if (def.teu) teu += def.teu;
    if (def.power) {
      funnels += 1;
      power += def.power;
    }
    if (def.placement === "attach") {
      if (def.propels) propellers += 1;
      if (def.steers) rudders += 1;
    }
    if (def.placement === "grid" && def.role === "bridge") bridges += 1;

    const partMass = def.placement === "grid" ? def.mass * cells : def.mass;
    mass += partMass;
    moment += partMass * (partBaseY(ship, part, occupancy) + def.height / 2);
    if (part.anchor.kind === "grid") {
      for (const cell of footprint) {
        lateralMoment += def.mass * (cell.z + 0.5 - centreline);
      }
    } else {
      const point = resolveAttachPoint(ship, part.anchor, occupancy);
      if (point) lateralMoment += partMass * (point.position.z - centreline);
    }
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
    hullSpeedModifier(ship.hull.bow, ship.hull.stern),
    DRIVETRAINS[ship.kind]
  );
  const stabilityRatio = moment / mass / beam;
  const stability = classifyStability(stabilityRatio);
  const listAngle = computeListAngle(
    lateralMoment / mass,
    beam,
    stabilityRatio
  );
  const balance = classifyBalance(listAngle);

  const fmtN = (n: number) => n.toLocaleString("en-US");
  const { powerPerProp } = DRIVETRAINS[ship.kind];
  const checks: Check[] = [];
  const addCheck = (
    code: WarningCode,
    label: string,
    failure: string | null
  ) => {
    checks.push({
      code,
      label,
      ok: failure === null,
      ...(failure === null ? {} : { detail: failure }),
    });
  };

  // Listed in build order; checks that don't apply yet are left out.
  addCheck(
    "no-bridge",
    "Bridge to steer from",
    bridges === 0 ? "No bridge — someone has to steer" : null
  );
  addCheck(
    "no-funnels",
    "Funnels for power",
    funnels === 0 ? "No funnels — she isn't going anywhere" : null
  );
  if (funnels > 0 || propellers > 0) {
    addCheck(
      "no-propellers",
      "Propellers to push her",
      funnels > 0 && propellers === 0 ? "No propellers — she can't move" : null
    );
  }
  if (funnels > 0 && propellers > 0) {
    addCheck(
      "needs-propellers",
      "Enough propellers for the funnels",
      power > propellers * powerPerProp
        ? "Not enough propellers for your funnels"
        : null
    );
  }
  if (propellers > 0) {
    addCheck(
      "no-rudder",
      "Rudder to steer",
      rudders === 0 ? "No rudder — she can't steer" : null
    );
  }
  addCheck(
    "lifeboats",
    "Lifeboat seat for everyone",
    coverage < 1
      ? `Lifeboats seat ${fmtN(lifeboatSeats)} of ${fmtN(peopleAboard)} aboard (${fmtN(peopleAboard - lifeboatSeats)} short)`
      : null
  );
  addCheck(
    "crew-berths",
    "A bed for every crew member",
    crewBerths < crew
      ? `Crew need beds: ${fmtN(crewBerths)} of ${fmtN(crew)}`
      : null
  );
  addCheck(
    "top-heavy",
    "Stays upright",
    stability === "Stable"
      ? null
      : stability === "Dangerous"
        ? "Dangerously top-heavy — she'll capsize"
        : "Top-heavy — lower the superstructure, or widen or lengthen the hull"
  );

  // Only listed while she is meaningfully lopsided, so level ships keep their
  // existing checklist.
  if (Math.abs(listAngle) >= LIST.checkAngle) {
    const degrees = Math.round((Math.abs(listAngle) * 180) / Math.PI);
    addCheck(
      "lopsided",
      "Sits level",
      `She leans ${degrees}° to ${listAngle < 0 ? "port" : "starboard"} — balance the weight on both sides`
    );
  }

  const warnings: StatWarning[] = checks.flatMap((check) =>
    check.ok ? [] : [{ code: check.code, message: check.detail ?? check.label }]
  );

  return {
    passengers,
    crew,
    crewBerths,
    peopleAboard,
    lifeboats,
    lifeboatSeats,
    teu,
    coverage,
    coverageLevel: coverageLevel(coverage),
    grossTonnage,
    topSpeedKnots,
    stability,
    stabilityRatio,
    watertightCompartments: compartmentSpecsOf(ship.hull).length,
    listAngle,
    balance,
    checks,
    warnings,
  };
}
