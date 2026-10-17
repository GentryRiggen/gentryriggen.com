import type { LevelId } from "@/lib/plane-builder/levels/types";
import type { Tiers } from "@/lib/plane-builder/plane/catalog";

/** Every plane look: three originals, then one per newer world. */
export type PlaneLook =
  | "meadow"
  | "canyon"
  | "mountains"
  | "seaplane"
  | "bush"
  | "jet"
  | "ski"
  | "twin"
  | "boom"
  | "glider";

/** What the plane rolls or floats on. */
export type PlaneGear = "none" | "floats" | "tyres" | "skis";

/** What a plane looks like at a set of tiers; PlaneModel just draws it. */
export interface PlaneParts {
  look: PlaneLook;
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
  /** Fuselage thickness; 1 is the classic body. */
  girth: number;
  /** How far the wings sit above the middle of the body. */
  wingHeight: number;
  /** Wing depth front to back; 1 is the classic wing. */
  wingChord: number;
  gear: PlaneGear;
  hasWingStruts: boolean;
  /** A boxy cabin sits on the body. */
  hasCabin: boolean;
  /** Two tail booms join a horizontal tail; the prop pushes from the pod. */
  hasTwinBooms: boolean;
  /** Engine pods on the wings (0 for planes without them). */
  enginePods: 0 | 2;
  /** The pods' propellers are fitted (engine tier 1 and up). */
  hasPodPropellers: boolean;
  /** A jet engine at the tail. */
  hasJetTail: boolean;
  hasIntakes: boolean;
  /** How hard the tail glows: 0 cold, 3 full blast. */
  exhaustGlow: 0 | 1 | 2 | 3;
  hasPointedNose: boolean;
  hasWinglets: boolean;
  hasGlowTrim: boolean;
  /** Size multiplier for engines, grows with the engine track. */
  engineScale: number;
  /** Where the wing tanks hang, as a share of the half span. */
  tankSpan: number;
}

interface LookShape {
  bodyBase: number;
  bodyStep: number;
  spanBase: number;
  spanStep: number;
  girth: number;
  wingHeight: number;
  wingChord: number;
  sweep: number;
}

const DEFAULT_SHAPE: LookShape = {
  bodyBase: 2,
  bodyStep: 0.15,
  spanBase: 1.2,
  spanStep: 0.5,
  girth: 1,
  wingHeight: 0,
  wingChord: 1,
  sweep: 0,
};

const JET_SWEEP = (35 * Math.PI) / 180;
const GLIDER_SWEEP = (15 * Math.PI) / 180;

/** Only what differs from the classic plane; the original looks have none. */
const LOOK_SHAPES: Partial<Record<PlaneLook, Partial<LookShape>>> = {
  seaplane: { wingHeight: 0.25 },
  bush: {
    bodyBase: 1.6,
    bodyStep: 0.1,
    girth: 1.25,
    wingHeight: 0.3,
  },
  jet: { girth: 0.9, sweep: JET_SWEEP },
  ski: { girth: 1.15, wingHeight: 0.34 },
  twin: { bodyBase: 2.2, bodyStep: 0.1, girth: 1.45 },
  boom: { girth: 1.1 },
  glider: {
    bodyBase: 2.4,
    bodyStep: 0.1,
    spanBase: 2,
    spanStep: 0.4,
    wingChord: 0.5,
    sweep: GLIDER_SWEEP,
  },
};

const PLANE_LOOKS: Record<LevelId, PlaneLook> = {
  meadow: "meadow",
  canyon: "canyon",
  mountains: "mountains",
  beach: "seaplane",
  jungle: "bush",
  city: "jet",
  glacier: "ski",
  volcano: "twin",
  storm: "boom",
  islands: "glider",
};

const BIPLANE_WINGS_TIER = 4;
const SWEPT_WINGS_TIER = 5;
const SWEEP_ANGLE = (30 * Math.PI) / 180;
const SECOND_PROPELLER_TIER = 6;
const AFTERBURNER_TIER = 7;
const TANKS_TIER = 3;
const STRIPES_TIER = 1;
const GOLD_TIER = 8;
const WINGLETS_TIER = 2;
const GLIDER_BASE_GIRTH = 0.8;
const GLIDER_GIRTH_STEP = 0.03;
const ENGINE_SCALE_STEP = 0.04;
const FULL_BLAST_TIER = 7;
const HOT_EXHAUST_TIER = 4;

const GEAR: Partial<Record<PlaneLook, PlaneGear>> = {
  seaplane: "floats",
  bush: "tyres",
  ski: "skis",
};

const HIGH_WING_LOOKS: readonly PlaneLook[] = ["seaplane", "bush", "ski"];
const NEW_LOOKS: readonly PlaneLook[] = [
  "seaplane",
  "bush",
  "jet",
  "ski",
  "twin",
  "boom",
  "glider",
];

function propellerCount(look: PlaneLook, engine: number): 0 | 1 | 2 {
  if (engine === 0) return 0;
  switch (look) {
    case "mountains":
    case "jet":
    case "twin":
    case "glider":
      return 0;
    case "canyon":
      return engine >= SECOND_PROPELLER_TIER ? 2 : 1;
    default:
      return 1;
  }
}

function exhaustGlow(look: PlaneLook, engine: number): 0 | 1 | 2 | 3 {
  if (look !== "jet" && look !== "glider") return 0;
  if (engine === 0) return 0;
  if (engine >= FULL_BLAST_TIER) return 3;
  return engine >= HOT_EXHAUST_TIER ? 2 : 1;
}

export function planeParts(levelId: LevelId, tiers: Tiers): PlaneParts {
  const look = PLANE_LOOKS[levelId];
  const shape = { ...DEFAULT_SHAPE, ...LOOK_SHAPES[look] };
  const isNewLook = NEW_LOOKS.includes(look);
  return {
    look,
    isDart: look === "meadow" && tiers.body === 0,
    bodyLength: shape.bodyBase + shape.bodyStep * tiers.body,
    wingSpan: shape.spanBase + shape.spanStep * tiers.wings,
    hasBiplane: look === "canyon" && tiers.wings >= BIPLANE_WINGS_TIER,
    sweep:
      look === "mountains"
        ? tiers.wings >= SWEPT_WINGS_TIER
          ? SWEEP_ANGLE
          : 0
        : shape.sweep,
    propellers: propellerCount(look, tiers.engine),
    hasNacelles: look === "mountains" && tiers.engine > 0,
    hasAfterburner: look === "mountains" && tiers.engine >= AFTERBURNER_TIER,
    hasTanks: tiers.fuel >= TANKS_TIER,
    hasStripes: tiers.multiplier >= STRIPES_TIER,
    isGold: tiers.multiplier >= GOLD_TIER,
    girth:
      look === "glider"
        ? GLIDER_BASE_GIRTH - GLIDER_GIRTH_STEP * tiers.body
        : shape.girth,
    wingHeight: shape.wingHeight,
    wingChord: shape.wingChord,
    gear: GEAR[look] ?? "none",
    hasWingStruts: HIGH_WING_LOOKS.includes(look),
    hasCabin: look === "ski",
    hasTwinBooms: look === "boom",
    enginePods: look === "twin" ? 2 : 0,
    hasPodPropellers: look === "twin" && tiers.engine > 0,
    hasJetTail: look === "jet" || (look === "glider" && tiers.engine > 0),
    hasIntakes: look === "jet",
    exhaustGlow: exhaustGlow(look, tiers.engine),
    hasPointedNose: look === "jet" || look === "glider",
    hasWinglets: look === "glider" && tiers.wings >= WINGLETS_TIER,
    hasGlowTrim: look === "glider",
    engineScale: isNewLook ? 1 + ENGINE_SCALE_STEP * tiers.engine : 1,
    tankSpan: look === "twin" || look === "boom" ? 0.85 : 0.5,
  };
}
