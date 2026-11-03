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
  isBeamOpen,
  isReadyToFlash,
  lighthouseCount,
  tankCapacity,
} from "./tick";
import { UPGRADES } from "./upgrades";
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
      next: "Build power plants and keep the grid steady",
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
      next: isReadyToFlash(run)
        ? "Flash the light to guide the boat home"
        : released >= TOTAL_LIGHTS - 1
          ? "Keep the boat on course until it reaches home"
          : "Let lights go and keep the last flame warm",
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

/**
 * The oil in the lamp's tank on the Coast, kept on the HUD so it is never out
 * of sight. Later parts show what is saved in the jar instead, since it closes
 * when the part ends.
 */
export function lightGauge(run: RunState): GaugeView | null {
  if (run.complete) return null;
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
