import type { RunState } from "../../engine/types";
import {
  hasBiggerNets,
  hasTideMill,
  isTideOpen,
  netStateIndex,
  tideLevel,
} from "./tide";
import {
  hasMissionControl,
  hasRacingFins,
  isProbeOut,
  isProbesOpen,
} from "./probes";
import { LET_GO } from "./upgrades";
import {
  COAST_LIGHTHOUSES,
  PHASE_COAST,
  PHASE_LAST,
  PHASE_NIGHT,
  PHASE_SKY,
  TOTAL_CITIES,
  TOTAL_LIGHTS,
  TOTAL_STARS,
} from "./resources";
import {
  boatHeadingOf,
  flameFraction,
  gridSteadiness,
  headingOf,
  isBoatOut,
  isFleetGlowing,
  isFlareOn,
  isGridGlowing,
  isRushOn,
  isStorming,
  keeperCount,
  level,
  lighthouseCount,
  shipsPerFlash,
  tankCapacity,
  tier,
} from "./tick";

/** Towns the Night scene can draw; `townsLit` counts toward this. */
export const TOWN_COUNT = 60;
/** Probes the Sky scene can draw. */
export const MAX_DRAWN_PROBES = 12;

export interface LightSceneInfo {
  /** Phase id: "coast", "night", "sky" or "last". */
  phase: string;
  phaseIndex: number;
  lighthouses: number;
  /** Lighthouses lit / COAST_LIGHTHOUSES, 0..1. */
  coastProgress: number;
  ships: number;
  /** Ships guided by one flash. */
  shipsPerFlash: number;
  lensLevel: number;
  /** Beam strength, 0..1 (soft cap, always grows with lens levels). */
  beam: number;
  keepers: number;
  /** 1 while a storm is blowing, else 0. */
  storm: number;
  cities: number;
  /** Cities lit / TOTAL_CITIES, 0..1. */
  citiesProgress: number;
  /** Towns drawn lit, 0..TOWN_COUNT (at least 1 once any city is lit). */
  townsLit: number;
  /** Night remaining, 0..1 (1 = full night). */
  night: number;
  /** supply / demand, 0..1. */
  powered: number;
  generators: number;
  collectors: number;
  /** Probes drawn, 0..MAX_DRAWN_PROBES (not the real count, which grows fast). */
  probes: number;
  starsRemaining: number;
  /** Stars left / TOTAL_STARS, 0..1. */
  starsFraction: number;
  lightsRemaining: number;
  /** Lights left / TOTAL_LIGHTS, 0..1. */
  lightsFraction: number;
  /** The flame, 0..1 (steps of 5%, so the picture is not redrawn every tick). */
  flame: number;
  /** 1 once the first ship's boat is out in the dark. */
  boatVisible: number;
  /** How far across the dark the boat is, 0..1 (steps of 1%). */
  boatProgress: number;
  /** How true its heading is, 0..1 (steps of 5%): 1 is straight at the beam. */
  boatHeading: number;
  /** 1 while the steady glow is on: sparkling cities, a fleet in formation. */
  glow: number;
  /** 1 once the last flash is made and the boat has turned for home. */
  finished: number;
  /** Lamp oil in the tank / its size, 0..1 (steps of 10%). */
  oilFraction: number;
  /** Chains bought so far on the coast (each 0 to its length). */
  wickTier: number;
  feesTier: number;
  dockTier: number;
  tankTier: number;
  trainTier: number;
  shuttersTier: number;
  /** 1 once the oil merchant contract is signed. */
  contract: number;
  /** Hand-crank level, 0..5. */
  crankLevel: number;
  /** Generators of each kind: little, steam, dam, wind and sun. */
  gen1: number;
  gen2: number;
  gen3: number;
  gen4: number;
  linesTier: number;
  subsTier: number;
  bulbsTier: number;
  gridTier: number;
  /** 1 once storm crews are hired (sandbag line by the towns). */
  stormCrews: number;
  /** 1 once the weather vane stands on the control post. */
  weatherVane: number;
  /** 1 once the tide clock is open: the sea breathes beside the lighthouse. */
  tideOpen: number;
  /** The water, 0..1 (12 steps, so the picture is not redrawn every tick). */
  tideLevel: number;
  /** The nets: 0 none out, 1 set and waiting for high tide, 2 full. */
  nets: number;
  /** 1 once the bigger nets are bought (a second, wider net). */
  biggerNets: number;
  /** 1 once the tide mill turns by the water. */
  tideMill: number;
  /** 1 once the probe races are open: a dock stands beside the mirror field. */
  raceOpen: number;
  /** 1 while the racing probe is away from the dock. */
  raceOut: number;
  /** 1 once the racing fins are bought. */
  raceFins: number;
  /** 1 once mission control stands by the dock (its scout flies on its own). */
  raceControl: number;
  /** Grid steadiness, 0..1 (steps of 10%): low means the lights flicker. */
  gridSteadiness: number;
  /** 1 while the evening rush is on. */
  rush: number;
  /** 1 while a solar flare can be caught. */
  flare: number;
  /** How true the probe fleet flies, 0..1 (steps of 10%). */
  fleetHeading: number;
  aimLevel: number;
  mirrorTier: number;
  copyTier: number;
  relayTier: number;
  navTier: number;
  enginesTier: number;
  appetiteTier: number;
  /** Bit i is set once the i-th light of LET_GO has been let go. */
  letGoMask: number;
  /** The lantern colour picked at the start, 1 to 3 (the first if none). */
  lantern: number;
}

/** Lantern colours to pick from, in the order they are offered. */
export const LANTERN_COUNT = 3;

/** The picked lantern, 1 to LANTERN_COUNT; an unpicked (or odd) one is 1. */
export function lanternOf(run: RunState): number {
  const picked = Math.round(run.resources.lantern ?? 0);
  return picked >= 1 && picked <= LANTERN_COUNT ? picked : 1;
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));
/** Rounds to the nearest 1/steps so a smooth number changes in steps. */
const step = (n: number, steps: number): number =>
  Math.round(clamp01(n) * steps) / steps;
const finite = (n: number): number => (Number.isFinite(n) ? n : 0);

/** A small plain object for the scene renderer; every number is finite. */
export function sceneInfo(run: RunState): LightSceneInfo {
  const r = run.resources;
  const phase = [PHASE_COAST, PHASE_NIGHT, PHASE_SKY, PHASE_LAST][
    Math.min(3, Math.max(0, run.phase))
  ];
  const lighthouses = lighthouseCount(run);
  const lens = level(run, "lens");
  const supply = finite(r.supply ?? 0);
  const demand = finite(r.demand ?? 0);
  const cities = finite(r.cities ?? 0);
  const lights = Math.max(0, finite(r.lights ?? TOTAL_LIGHTS));
  const stars = Math.max(0, finite(r.stars ?? TOTAL_STARS));
  return {
    phase,
    phaseIndex: run.phase,
    lighthouses,
    coastProgress: clamp01(lighthouses / COAST_LIGHTHOUSES),
    ships: Math.floor(finite(r.ships ?? 0)),
    shipsPerFlash: finite(shipsPerFlash(run)),
    lensLevel: lens,
    beam: clamp01(lens / (lens + 12)),
    keepers: finite(keeperCount(run)),
    storm: isStorming(run) && run.phase === 0 ? 1 : 0,
    cities,
    citiesProgress: clamp01(cities / TOTAL_CITIES),
    townsLit:
      cities > 0
        ? Math.max(1, Math.round(clamp01(cities / TOTAL_CITIES) * TOWN_COUNT))
        : 0,
    // Quantized: the picture only needs these in steps, not every tick.
    night: step(finite(r.night ?? 100) / 100, 50),
    powered: demand > 0 ? step(supply / demand, 20) : 0,
    generators:
      level(run, "gen1") +
      level(run, "gen2") +
      level(run, "gen3") +
      level(run, "gen4"),
    collectors: finite(r.collectors ?? 0),
    probes:
      finite(r.probes ?? 0) >= 1
        ? Math.min(
            MAX_DRAWN_PROBES,
            1 + Math.floor(Math.log2(Math.floor(r.probes) + 1))
          )
        : 0,
    starsRemaining: Math.ceil(stars),
    // In steps of one drawn star (the sky draws 70) so it is not redrawn
    // every tick while the probes feed.
    starsFraction: Math.ceil(clamp01(stars / TOTAL_STARS) * 70) / 70,
    lightsRemaining: lights,
    lightsFraction: clamp01(lights / TOTAL_LIGHTS),
    flame: step(flameFraction(run), 20),
    boatVisible: isBoatOut(run) ? 1 : 0,
    boatProgress: step(clamp01(finite(r.boatProgress ?? 0) / 100), 100),
    boatHeading: step(boatHeadingOf(run) / 100, 20),
    glow: isGridGlowing(run) || isFleetGlowing(run) ? 1 : 0,
    finished: run.flags.finished ? 1 : 0,
    lantern: lanternOf(run),
    oilFraction: step(finite(r.oil ?? 0) / Math.max(1, tankCapacity(run)), 10),
    wickTier: tier(run, "wick"),
    feesTier: tier(run, "fees"),
    dockTier: tier(run, "dock"),
    tankTier: tier(run, "tank"),
    trainTier: tier(run, "train"),
    shuttersTier: tier(run, "shutters"),
    contract: level(run, "contract") > 0 ? 1 : 0,
    crankLevel: level(run, "crank"),
    gen1: level(run, "gen1"),
    gen2: level(run, "gen2"),
    gen3: level(run, "gen3"),
    gen4: level(run, "gen4"),
    linesTier: tier(run, "lines"),
    subsTier: tier(run, "subs"),
    bulbsTier: tier(run, "bulbs"),
    gridTier: tier(run, "grid"),
    stormCrews: level(run, "storm-crews") > 0 ? 1 : 0,
    weatherVane: level(run, "weather-vane") > 0 ? 1 : 0,
    tideOpen: isTideOpen(run) ? 1 : 0,
    tideLevel: isTideOpen(run) ? step(tideLevel(run), 12) : 0,
    nets: isTideOpen(run) ? netStateIndex(run) : 0,
    biggerNets: hasBiggerNets(run) ? 1 : 0,
    tideMill: hasTideMill(run) ? 1 : 0,
    raceOpen: isProbesOpen(run) ? 1 : 0,
    raceOut: isProbeOut(run) ? 1 : 0,
    raceFins: hasRacingFins(run) ? 1 : 0,
    raceControl: hasMissionControl(run) ? 1 : 0,
    gridSteadiness: step(finite(gridSteadiness(run)) / 100, 10),
    rush: isRushOn(run) ? 1 : 0,
    flare: isFlareOn(run) ? 1 : 0,
    fleetHeading: step(finite(headingOf(run)) / 100, 10),
    aimLevel: level(run, "aim"),
    mirrorTier: tier(run, "mirror"),
    copyTier: tier(run, "copy"),
    relayTier: tier(run, "relay"),
    navTier: tier(run, "nav"),
    enginesTier: tier(run, "engines"),
    appetiteTier: tier(run, "appetite"),
    letGoMask: LET_GO.reduce(
      (mask, light, i) => (level(run, light.id) > 0 ? mask | (1 << i) : mask),
      0
    ),
  };
}
