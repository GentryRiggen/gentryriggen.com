import type { RunState } from "../../engine/types";
import { isTollOpen, tollStep, trafficShare } from "./toll";
import {
  isDarkBanner,
  isRelit,
  isTankerIn,
  barrelsRolling,
  isTankerArriving,
  tankerDeal,
} from "./tanker";
import {
  COPYING,
  MIRRORS,
  SHIELDS,
  SPEED,
  isDialsOpen,
  isGoneWild,
  isHome,
  isRecalling,
  isSettling,
  pointsAt,
  wildLevel,
} from "./design";
import {
  distanceNow,
  forecastSize,
  hitSize,
  lastBurn,
  lastSaved,
  sunMood,
} from "./sunEdge";
import {
  LIGHT_COUNT,
  chillForecast,
  chillSize,
  fogOf,
  goodbyeIndex,
  hearthTier,
  isChillBlowing,
  isSurging,
  letGoMask,
  companyPips,
  isLit,
} from "./warmth";
import { hasFork, windRamp } from "./forkState";
import {
  batteryCount,
  batteryFlow,
  chargeShare01,
  dayShare,
  districtsDark,
  eveningLevel,
  gridBanner,
  isGridGlowing,
  isRushNow,
} from "./grid";
import {
  buildingCrews,
  crewsAt,
  crewsOnTheRoad,
  hasCrew,
  isOut,
  isStormHit,
  isWeatherOpen,
  schoolCrews,
} from "./weather";
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
  flameFraction,
  isBoatOut,
  isGridInPlay,
  isStorming,
  lampStep,
  keeperCount,
  level,
  lighthouseCount,
  flashShipsAtFullTraffic,
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
  /** 1 while the coast lamp has no oil (it burns dim). */
  lampDry: number;
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
  /** The fork of each part: 0 not chosen, 1 the first side, 2 the second. */
  forkCoast: number;
  forkNight: number;
  forkSky: number;
  forkLast: number;
  /** How far the wind farms are built, 0..1 (4 steps; 0 unless wind was chosen). */
  windBuilt: number;
  /** 1 once the first ship's boat is out in the dark. */
  boatVisible: number;
  /** How far across the dark the boat is, 0..1 (steps of 1%). */
  boatProgress: number;
  /** 1 while the flame is warm enough for the boat to surge. */
  surge: number;
  /** The fog on the water, 0..4 (0 none, 4 thick): it creeps in as the flame cools. */
  fog: number;
  /** How much company each lit light keeps: one base-4 digit a light (see `brightCode`). */
  brightCode: number;
  /** The light whose goodbye is showing (1 up), or 0. */
  goodbye: number;
  /** The cold wind: 0 none, 1-3 forecast (mild to bitter), 4-6 blowing. */
  chill: number;
  /** Hearth steps bought, 0 to 6. */
  hearthTier: number;
  /** Steps of the boat's sails, the lamp glass and warm company, so each shows in the picture. */
  sailTier: number;
  slowburnTier: number;
  companyTier: number;
  /** Steps of the crossing song, 0 to 4: notes drift over the boat. */
  songTier: number;
  /** 1 while the steady glow is on: sparkling cities. */
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
  /** Batteries built (all sizes) and how full they are, 0..1 in tenths. */
  batteries: number;
  charge: number;
  /** 1 once the grid's day begins (the planet has a sun and a dusk). */
  gridOpen: number;
  /** Where the day is, in twentieths (0..19), and 1 during the evening rush. */
  dayStep: number;
  rushOn: number;
  /** Tonight's rush: 0 mild to 3 scorching. */
  eveningLevel: number;
  /** The batteries: 0 resting, 1 charging, 2 giving power to the rush. */
  flow: number;
  /** Districts dark right now, 0..10. */
  dark: number;
  /** The moment on show: 0 none, 1 LIT ALL NIGHT, 2 BLACKOUT. */
  gridBanner: number;
  /** Crews on each post (there, not on the road) and any on the road. */
  crewBuild: number;
  crewSchool: number;
  /** 1 once the weather desk is open (the three towns have watch towers). */
  weatherOpen: number;
  /** Crews on watch at each of the three towns (there, not on the road). */
  watch0: number;
  watch1: number;
  watch2: number;
  crewRoad: number;
  /** Bit i is set while town i has no lights (a storm hit it). */
  townsOut: number;
  /** 1 for a few seconds after a storm hit, and the town it hit. */
  stormHit: number;
  stormTown: number;
  /** 1 while a crew is watching the town the storm hit. */
  stormHeld: number;
  /** The streetlights, 0 (soft) to 3 (dazzling). */
  lampStep: number;
  /** 1 once storm crews are hired (sandbag line by the towns). */
  stormCrews: number;
  /** 1 once the weather vane stands on the control post. */
  weatherVane: number;
  /** 1 once the harbor desk is open (the toll sign stands on the quay). */
  tollOpen: number;
  /** The toll step, 0 (low) to 4. */
  tollStep: number;
  /** Ships choosing the harbor, in tenths (0..10): the rest sail on to the rival. */
  traffic: number;
  /** 1 while a tanker is tied up with cheap oil. */
  tanker: number;
  /** The tanker's deal as tens of percent off the market (0 none, 3 = about 30% off). */
  tankerDeal: number;
  /** 1 for the first seconds a tanker is in: the "cheap oil" shout. */
  tankerNew: number;
  /** 1 for a few seconds after oil is bought: barrels roll into the tanks. */
  barrels: number;
  /** 1 for the first seconds of a dry spell: the lamp has gone dark. */
  darkBanner: number;
  /** 1 for a few seconds after the lamp is lit again: the beam bursts. */
  relit: number;
  /** 1 once the sky's dials are open: the design bench and the sun's edge. */
  dialsOpen: number;
  /** The sun's mood: 0 quiet, 1 usual, 2 restless. */
  sunMood: number;
  /** Where the fleet flies, in halves of a step (0 far .. 8 brushing the sun). */
  sunDist: number;
  /** Design points at work in speed, mirrors, copying and shields (0..8). */
  dsSpeed: number;
  dsMirrors: number;
  dsCopying: number;
  dsShields: number;
  /** 1 while design points are on their way to a new place. */
  dsMoving: number;
  /** Wild probes: 0 none .. 4 most of the fleet. */
  wild: number;
  /** 1 while a green tether pulls the wild ones home. */
  tether: number;
  /** The forecast: 0 none, then 1 small, 2 medium, 3 big flare coming. */
  flareFore: number;
  /** A flare's moment: 0 none, then 1 small, 2 medium, 3 big. */
  flareHit: number;
  /** What it burned, in twentieths of the fleet (0..20, so 5% steps), and what shields saved. */
  flareLost: number;
  flareSaved: number;
  /** 1 for a few seconds when probes go wild, and when they come home. */
  goneWild: number;
  homeAgain: number;
  aimLevel: number;
  mirrorTier: number;
  copyTier: number;
  relayTier: number;
  navTier: number;
  enginesTier: number;
  appetiteTier: number;
  /** Bit i is set once the i-th remembered light has been let go. */
  letGoMask: number;
  /** The lantern colour picked at the start, 1 to 3 (the first if none). */
  lantern: number;
}

/**
 * One base-4 digit a lit light: how much company it keeps this run (0 a
 * little .. 3 a lot), so the picture can draw the big ones big. It changes
 * only when a light goes, never every tick.
 */
function brightCode(run: RunState): number {
  if (run.phase !== 3) return 0;
  let code = 0;
  for (let i = 0; i < LIGHT_COUNT; i += 1)
    if (isLit(run, i)) code += Math.min(3, companyPips(run, i) - 1) * 4 ** i;
  return code;
}

/** 0 none, 1-3 a forecast wind (mild to bitter), 4-6 a wind blowing. */
function chillCode(run: RunState): number {
  if (isChillBlowing(run)) return 4 + chillSize(run);
  const coming = chillForecast(run);
  return coming === null ? 0 : 1 + coming;
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
    // Whatever the traffic is doing, so it sliding up or down never redraws the picture.
    shipsPerFlash: finite(flashShipsAtFullTraffic(run)),
    lensLevel: lens,
    beam: clamp01(lens / (lens + 12)),
    keepers: finite(keeperCount(run)),
    storm: isStorming(run) && run.phase === 0 ? 1 : 0,
    lampDry: run.phase === 0 && finite(r.oil ?? 0) <= 0 ? 1 : 0,
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
    forkCoast: hasFork(run, "fresnel") ? 1 : hasFork(run, "crews") ? 2 : 0,
    forkNight: hasFork(run, "coal") ? 1 : hasFork(run, "wind") ? 2 : 0,
    forkSky: hasFork(run, "swarm") ? 1 : hasFork(run, "mirrors") ? 2 : 0,
    forkLast: hasFork(run, "release") ? 1 : hasFork(run, "keep") ? 2 : 0,
    windBuilt: step(windRamp(run), 4),
    boatVisible: isBoatOut(run) ? 1 : 0,
    boatProgress: step(clamp01(finite(r.boatProgress ?? 0) / 100), 100),
    surge: isSurging(run) ? 1 : 0,
    fog: run.phase === 3 ? Math.round(fogOf(run) * 4) : 0,
    brightCode: brightCode(run),
    goodbye: (goodbyeIndex(run) ?? -1) + 1,
    chill: chillCode(run),
    hearthTier: hearthTier(run),
    sailTier: tier(run, "sail"),
    slowburnTier: tier(run, "slowburn"),
    companyTier: tier(run, "company"),
    songTier: tier(run, "song"),
    glow: isGridGlowing(run) ? 1 : 0,
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
    batteries: Math.min(14, batteryCount(run)),
    charge: step(chargeShare01(run), 10),
    gridOpen: isGridInPlay(run) ? 1 : 0,
    dayStep: isGridInPlay(run)
      ? Math.min(19, Math.floor(dayShare(run) * 20))
      : 0,
    rushOn: isRushNow(run) ? 1 : 0,
    eveningLevel: isGridInPlay(run) ? eveningLevel(run) : 0,
    flow: batteryFlow(run),
    dark: districtsDark(run),
    gridBanner: gridBanner(run),
    crewBuild: run.phase === 1 ? buildingCrews(run) : 0,
    crewSchool: run.phase === 1 ? schoolCrews(run) : 0,
    weatherOpen: isWeatherOpen(run) ? 1 : 0,
    watch0: run.phase === 1 ? crewsAt(run, 0) : 0,
    watch1: run.phase === 1 ? crewsAt(run, 1) : 0,
    watch2: run.phase === 1 ? crewsAt(run, 2) : 0,
    crewRoad: run.phase === 1 ? crewsOnTheRoad(run) : 0,
    townsOut:
      run.phase === 1
        ? [0, 1, 2].reduce(
            (mask, t) => (isOut(run, t) ? mask | (1 << t) : mask),
            0
          )
        : 0,
    stormHit: isStormHit(run) ? 1 : 0,
    stormTown: Math.round(run.resources.wxLastTown ?? 0),
    stormHeld:
      isStormHit(run) && hasCrew(run, Math.round(run.resources.wxLastTown ?? 0))
        ? 1
        : 0,
    lampStep: run.phase === 1 ? lampStep(run) : 0,
    stormCrews: level(run, "storm-crews") > 0 ? 1 : 0,
    weatherVane: level(run, "weather-vane") > 0 ? 1 : 0,
    tollOpen: isTollOpen(run) ? 1 : 0,
    tollStep: tollStep(run),
    traffic: Math.round(clamp01(trafficShare(run)) * 10),
    tanker: isTankerIn(run) ? 1 : 0,
    tankerDeal: isTankerIn(run)
      ? Math.max(0, Math.round((1 - tankerDeal(run)) * 10))
      : 0,
    tankerNew: isTankerArriving(run) ? 1 : 0,
    barrels: run.phase === 0 && barrelsRolling(run) ? 1 : 0,
    darkBanner: run.phase === 0 && isDarkBanner(run) ? 1 : 0,
    relit: run.phase === 0 && isRelit(run) ? 1 : 0,
    dialsOpen: isDialsOpen(run) ? 1 : 0,
    sunMood: isDialsOpen(run) ? sunMood(run) : 1,
    sunDist: isDialsOpen(run) ? Math.round(distanceNow(run) * 2) : 0,
    dsSpeed: isDialsOpen(run) ? Math.round(pointsAt(run, SPEED)) : 0,
    dsMirrors: isDialsOpen(run) ? Math.round(pointsAt(run, MIRRORS)) : 0,
    dsCopying: isDialsOpen(run) ? Math.round(pointsAt(run, COPYING)) : 0,
    dsShields: isDialsOpen(run) ? Math.round(pointsAt(run, SHIELDS)) : 0,
    dsMoving: isDialsOpen(run) && isSettling(run) ? 1 : 0,
    wild: isDialsOpen(run) ? wildLevel(run) : 0,
    tether: isDialsOpen(run) && isRecalling(run) ? 1 : 0,
    flareFore: isDialsOpen(run) ? (forecastSize(run) ?? -1) + 1 : 0,
    flareHit: isDialsOpen(run) ? (hitSize(run) ?? -1) + 1 : 0,
    flareLost:
      isDialsOpen(run) && hitSize(run) !== null
        ? Math.min(20, Math.round(lastBurn(run) * 20))
        : 0,
    flareSaved:
      isDialsOpen(run) && hitSize(run) !== null
        ? Math.min(20, Math.round(lastSaved(run) * 20))
        : 0,
    goneWild: isDialsOpen(run) && isGoneWild(run) ? 1 : 0,
    homeAgain: isDialsOpen(run) && isHome(run) ? 1 : 0,
    aimLevel: level(run, "aim"),
    mirrorTier: tier(run, "mirror"),
    copyTier: tier(run, "copy"),
    relayTier: tier(run, "relay"),
    navTier: tier(run, "nav"),
    enginesTier: tier(run, "engines"),
    appetiteTier: tier(run, "appetite"),
    letGoMask: letGoMask(run),
  };
}
