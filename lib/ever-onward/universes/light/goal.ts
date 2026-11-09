import { goalAmount } from "../../engine/goal";
import { upgradeCost } from "../../engine/engine";
import { formatNumber } from "../../engine/format";
import type { GaugeView, GoalView, RunState } from "../../engine/types";
import { COAST_LIGHTHOUSES, TOTAL_CITIES, TOTAL_STARS } from "./resources";
import {
  isBeamOpen,
  isGridInPlay,
  lighthouseCount,
  tankCapacity,
} from "./tick";
import { boatProgressOf, isReadyToFlash, isSurging, warmthOf } from "./warmth";
import { UPGRADES } from "./upgrades";
import { batteryCapacity, chargeShare01 } from "./grid";
import { isDialsOpen } from "./design";
import { flareSafety } from "./sunEdge";
import { fundBalance, fundKind, isFundOpen } from "./fund";

const LIGHTHOUSE = UPGRADES.find((u) => u.id === "lighthouse");

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
      next: "Grow the probe fleet and keep it safe from flares",
    };
  }
  if (run.phase === 3) {
    const home = boatProgressOf(run);
    return {
      label: "BRING THE BOAT HOME",
      current: Math.floor(home),
      target: 100,
      unit: "% of the way",
      progress: home - Math.floor(home),
      next: lastNext(run),
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

/** What to do next in the Last Light: a hint about warmth, never an instruction. */
function lastNext(run: RunState): string {
  if (isReadyToFlash(run)) return "Flash the light to guide the boat home";
  if (warmthOf(run) < FLAME_LOW)
    return "A cold flame means a slow boat. Fewer lights burn less warmth";
  if (isSurging(run)) return "The flame is warm. The boat is surging";
  return "A warmer flame guides the boat faster";
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

/** The warmth meter turns orange here, and red (cold) here. */
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
 * night is the batteries, how safe the fleet is from a flare in the sky, the flame at the end.
 */
function watchedMeter(run: RunState): GaugeView | null {
  if (run.phase === 1 && isGridInPlay(run) && batteryCapacity(run) > 0) {
    const view = percentMeter("BATTERY", chargeShare01(run), 0.5, 0.1);
    return { ...view, status: view.isCritical ? "EMPTY" : view.status };
  }
  if (run.phase === 2 && isDialsOpen(run) && (run.resources.probes ?? 0) >= 4) {
    const view = percentMeter("FLARE SAFE", flareSafety(run), 0.6, 0.2);
    return { ...view, status: view.isCritical ? "DANGER" : view.status };
  }
  if (run.phase === 3)
    return percentMeter("WARMTH", warmthOf(run), FLAME_LOW, FLAME_COLD);
  return null;
}
