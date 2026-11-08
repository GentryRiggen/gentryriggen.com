import { goalAmount } from "../../engine/goal";
import { upgradeCost } from "../../engine/engine";
import { formatNumber } from "../../engine/format";
import type { GaugeView, GoalView, RunState } from "../../engine/types";
import {
  COAST_LIGHTHOUSES,
  TOTAL_CITIES,
  TOTAL_STARS,
  TOTAL_LIGHTS,
} from "./resources";
import {
  flameFraction,
  headingOf,
  isBeamOpen,
  isCourseAuto,
  isCourseInPlay,
  isGridInPlay,
  isReadyToFlash,
  lighthouseCount,
  tankCapacity,
} from "./tick";
import { TUNING } from "./tuning";
import { LET_GO, UPGRADES } from "./upgrades";
import { batteryCapacity, chargeShare01 } from "./grid";
import { fundBalance, fundKind, isFundOpen } from "./fund";

const LIGHTHOUSE = UPGRADES.find((u) => u.id === "lighthouse");
const LET_GO_IDS = new Set(LET_GO.map((l) => l.id));

/** The cheapest light still lit that can be let go now, or null. */
function nextLetGo(run: RunState) {
  const open = UPGRADES.filter(
    (u) =>
      LET_GO_IDS.has(u.id) &&
      !(run.owned[u.id] > 0) &&
      (!u.visibleWhen || u.visibleWhen(run))
  );
  if (open.length === 0) return null;
  return open.reduce((a, b) =>
    upgradeCost(run, b) < upgradeCost(run, a) ? b : a
  );
}

/**
 * Each chapter reads the same quantities that drive its completion rules.
 */
export function lightGoal(run: RunState): GoalView | null {
  if (run.complete) return null;
  if (run.phase === 1) {
    const lit =
      TOTAL_CITIES * (1 - goalAmount(run.resources.night, 100, 100) / 100);
    return {
      label: "LIGHT EVERY CITY",
      current: Math.floor(lit),
      target: TOTAL_CITIES,
      unit: "cities",
      progress: lit - Math.floor(lit),
      next: `Supply ${formatNumber(Math.floor(run.resources.supply ?? 0))} / ${formatNumber(Math.ceil(run.resources.demand ?? 0))} MW: more plants and lines light more`,
    };
  }
  if (run.phase === 2) {
    const taken =
      TOTAL_STARS - goalAmount(run.resources.stars, TOTAL_STARS, TOTAL_STARS);
    return {
      label: "GATHER THE STARLIGHT",
      current: Math.floor(taken),
      target: TOTAL_STARS,
      unit: "stars",
      progress: taken - Math.floor(taken),
      next: "Grow the probe fleet and keep it on course",
    };
  }
  if (run.phase === 3) {
    const released = Math.min(
      TOTAL_LIGHTS - 1,
      TOTAL_LIGHTS -
        goalAmount(run.resources.lights, TOTAL_LIGHTS, TOTAL_LIGHTS)
    );
    return {
      label: "KEEP ONE LIGHT ON",
      current: released,
      target: TOTAL_LIGHTS - 1,
      unit: "lights released",
      ...lastNext(run, released),
    };
  }
  if (!LIGHTHOUSE) return null;
  const current = Math.min(COAST_LIGHTHOUSES, lighthouseCount(run));
  if (current >= COAST_LIGHTHOUSES) return null;
  const cost = upgradeCost(run, LIGHTHOUSE);
  const coins = run.resources.coins ?? 0;
  return {
    label: "LIGHT THE COAST",
    current,
    target: COAST_LIGHTHOUSES,
    unit: "lighthouses",
    next: `Next lighthouse: ${formatNumber(Math.ceil(cost))} coins`,
    progress: goalAmount(coins, cost) / cost,
  };
}

/** What to do next in the Last Light, with the resolve saved toward it. */
function lastNext(
  run: RunState,
  released: number
): { next: string; progress?: number } {
  if (isReadyToFlash(run))
    return { next: "Flash the light to guide the boat home" };
  if (released >= TOTAL_LIGHTS - 1)
    return { next: "Keep the boat on course until it reaches home" };
  const light = nextLetGo(run);
  if (!light) return { next: "Save resolve to let the next light go" };
  const cost = upgradeCost(run, light);
  const name = light.name.replace(/^Let /, "let ").replace(/ go dark$/, " go");
  return {
    next: `Next: ${name}, ${formatNumber(Math.ceil(cost))} resolve`,
    progress: cost > 0 ? goalAmount(run.resources.resolve, cost) / cost : 0,
  };
}

/**
 * The oil in the lamp's tank on the Coast, kept on the HUD so it is never out
 * of sight. Later parts show what is saved in the jar instead, since it closes
 * when the part ends.
 */
export function lightGauge(run: RunState): GaugeView | null {
  if (run.complete) return null;
  const watched = watchedMeter(run);
  if (watched) return watched;
  if (run.phase > 0) {
    const saved = isFundOpen(run) ? fundBalance(run) : 0;
    if (saved <= 0) return null;
    const kind = fundKind(run);
    return {
      label: kind.name.toUpperCase(),
      current: saved,
      max: saved,
      isLow: false,
      isCritical: false,
      display: `${formatNumber(Math.floor(saved))} saved`,
      status: "",
      hasBar: false,
    };
  }
  if (!isBeamOpen(run)) return null;
  const max = Math.max(1, tankCapacity(run));
  const current = Math.min(max, Math.max(0, run.resources.oil ?? 0));
  return {
    label: "OIL",
    current,
    max,
    isLow: current / max <= 0.35,
    isCritical: current <= 0 || current / max <= 0.12,
  };
}

/** The flame meter turns orange here, and red (cold) here. */
export const FLAME_LOW = 0.3;
export const FLAME_COLD = 0.1;

/** A 0..1 share as a meter out of 100. */
function percentMeter(
  label: string,
  share: number,
  low: number,
  critical: number,
  glowAt?: number
): GaugeView {
  const value = Math.min(1, Math.max(0, Number.isFinite(share) ? share : 0));
  const isCritical = value <= critical;
  const isLow = value <= low;
  return {
    label,
    current: value * 100,
    max: 100,
    isLow,
    isCritical,
    display: `${Math.round(value * 100)}%`,
    status: isCritical
      ? "COLD"
      : isLow
        ? "LOW"
        : glowAt !== undefined && value * 100 >= glowAt
          ? "GLOW"
          : "",
  };
}

/**
 * The number this part asks the player to look after, kept on the HUD so a
 * dim flame or a drifting fleet is never hidden in the details: the grid at
 * night is the batteries, the fleet's heading in the sky, the flame at the end.
 */
function watchedMeter(run: RunState): GaugeView | null {
  if (run.phase === 1 && isGridInPlay(run) && batteryCapacity(run) > 0) {
    const view = percentMeter("BATTERY", chargeShare01(run), 0.5, 0.1);
    return { ...view, status: view.isCritical ? "EMPTY" : view.status };
  }
  if (run.phase === 2 && isCourseInPlay(run) && !isCourseAuto(run)) {
    const view = percentMeter(
      "COURSE",
      headingOf(run) / 100,
      0.5,
      0.15,
      TUNING.sky.glowAt
    );
    return { ...view, status: view.isCritical ? "LOST" : view.status };
  }
  if (run.phase === 3)
    return percentMeter("FLAME", flameFraction(run), FLAME_LOW, FLAME_COLD);
  return null;
}
