import type { RunState } from "../../engine/types";
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
  isBoatOut,
  isStorming,
  keeperCount,
  level,
  lighthouseCount,
  shipsPerFlash,
} from "./tick";

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
  /** Night remaining, 0..1 (1 = full night). */
  night: number;
  /** supply / demand, 0..1. */
  powered: number;
  generators: number;
  collectors: number;
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
  /** 1 once the last flash is made and the boat has turned for home. */
  finished: number;
  /** Seconds into the run the very first ship was guided; 0 if not yet. */
  firstShipSeconds: number;
  /** 1 if that first ship came in a storm. */
  firstShipStorm: number;
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
    night: clamp01(finite(r.night ?? 100) / 100),
    powered: demand > 0 ? clamp01(supply / demand) : 0,
    generators:
      level(run, "gen1") +
      level(run, "gen2") +
      level(run, "gen3") +
      level(run, "gen4"),
    collectors: finite(r.collectors ?? 0),
    probes: finite(Math.floor(r.probes ?? 0)),
    starsRemaining: Math.ceil(stars),
    starsFraction: clamp01(stars / TOTAL_STARS),
    lightsRemaining: lights,
    lightsFraction: clamp01(lights / TOTAL_LIGHTS),
    flame: step(flameFraction(run), 20),
    boatVisible: isBoatOut(run) ? 1 : 0,
    boatProgress: step(clamp01(finite(r.boatProgress ?? 0) / 100), 100),
    boatHeading: step(boatHeadingOf(run) / 100, 20),
    finished: run.flags.finished ? 1 : 0,
    firstShipSeconds: Math.floor(finite(r.firstShipAt ?? 0)),
    firstShipStorm: r.firstShipStorm ? 1 : 0,
  };
}
