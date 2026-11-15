import { TOOL_ORDER, type ToolId } from "../tools";
import type { Trace } from "./simulate";

export interface MetricDef {
  id: string;
  /** Full points inside [lo, hi]. */
  lo: number;
  hi: number;
  /** Zero points here and beyond; failing it caps the total at 59. */
  gate: number;
  weight: number;
  /** Where the below-band side hits zero (no gate); omit for none. */
  floor?: number;
}

export const METRICS: readonly MetricDef[] = [
  { id: "firstUnlockSec", lo: 0, hi: 60, gate: 120, weight: 15 },
  { id: "maxGapMin", lo: 0, hi: 5, gate: 8, weight: 25 },
  // Below 60 min is too fast; it fades to 0 at 30 min but is never a gate.
  { id: "allToolsMin", lo: 60, hi: 90, gate: 150, weight: 25, floor: 30 },
  { id: "nukeFamilyByMin", lo: 0, hi: 25, gate: 45, weight: 15 },
  { id: "alienByMin", lo: 0, hi: 70, gate: 110, weight: 10 },
  // Higher is better: lo is the band, gate is the minimum.
  { id: "newThingsFirst30Min", lo: 8, hi: Infinity, gate: 5, weight: 10 },
];

export const NUKE_FAMILY: readonly ToolId[] = ["nuke", "nukeTwin", "nukeRain"];
export const ALIEN_TECH: readonly ToolId[] = [
  "alienLaser",
  "ufoSwarm",
  "gravityBeam",
  "nanobots",
  "mothership",
];

export interface MetricScore {
  id: string;
  value: number;
  points: number;
  max: number;
  gateFailed: boolean;
}

export interface BotScore {
  bot: string;
  seed: number;
  metrics: MetricScore[];
  uncapped: number;
  total: number;
  capped: boolean;
}

const toolTime = (trace: Trace, id: ToolId): number => {
  const e = trace.events.find((x) => x.kind === "tool" && x.id === id);
  return e ? e.t : Infinity;
};
/** Seconds when the last of the tools opened (Infinity if one never did). */
const allBy = (trace: Trace, ids: readonly ToolId[]): number =>
  Math.max(0, ...ids.map((id) => toolTime(trace, id)));

export function maxGapSec(trace: Trace, windowSec: number): number {
  let prev = 0;
  let gap = 0;
  for (const e of trace.events) {
    if (e.t > windowSec) break;
    gap = Math.max(gap, e.t - prev);
    prev = e.t;
  }
  return Math.max(gap, windowSec - prev);
}

/** Raw metric values from a trace. */
export function measure(trace: Trace): Record<string, number> {
  const freeTools = TOOL_ORDER.filter(
    (id) => !trace.events.some((e) => e.kind === "tool" && e.id === id)
  );
  const toolsOpen = freeTools.length === 1 && freeTools[0] === "asteroid";
  const lastTool = Math.max(
    0,
    ...trace.events.filter((e) => e.kind === "tool").map((e) => e.t)
  );
  return {
    firstUnlockSec: trace.events.length ? trace.events[0].t : Infinity,
    maxGapMin: maxGapSec(trace, 90 * 60) / 60,
    allToolsMin: toolsOpen ? lastTool / 60 : Infinity,
    nukeFamilyByMin: allBy(trace, NUKE_FAMILY) / 60,
    alienByMin: allBy(trace, ALIEN_TECH) / 60,
    newThingsFirst30Min: trace.events.filter((e) => e.t <= 30 * 60).length,
  };
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** 0..1 for one metric, and whether its gate failed. */
export function scoreMetric(
  def: MetricDef,
  value: number
): { fraction: number; gateFailed: boolean } {
  const higherBetter = def.hi === Infinity;
  if (higherBetter) {
    return {
      fraction: clamp01((value - def.gate) / (def.lo - def.gate)),
      gateFailed: value < def.gate,
    };
  }
  if (value > def.hi) {
    return {
      fraction: clamp01((def.gate - value) / (def.gate - def.hi)),
      gateFailed: value > def.gate,
    };
  }
  if (value < def.lo && def.floor !== undefined) {
    return {
      fraction: clamp01((value - def.floor) / (def.lo - def.floor)),
      gateFailed: false,
    };
  }
  return { fraction: 1, gateFailed: false };
}

export function scoreTrace(trace: Trace): BotScore {
  const values = measure(trace);
  const metrics: MetricScore[] = METRICS.map((def) => {
    const { fraction, gateFailed } = scoreMetric(def, values[def.id]);
    return {
      id: def.id,
      value: values[def.id],
      points: fraction * def.weight,
      max: def.weight,
      gateFailed,
    };
  });
  const uncapped = metrics.reduce((n, m) => n + m.points, 0);
  const capped = metrics.some((m) => m.gateFailed) && uncapped > 59;
  return {
    bot: trace.bot,
    seed: trace.seed,
    metrics,
    uncapped,
    total: capped ? 59 : uncapped,
    capped,
  };
}

export interface Scorecard {
  scores: BotScore[];
  /** Mean total over every bot and seed. */
  mean: number;
  /** Mean total per bot id. */
  byBot: Record<string, number>;
  /** The metric that lost the most points on average. */
  worst: { id: string; pointsLost: number };
}

export function scorecard(traces: readonly Trace[]): Scorecard {
  const scores = traces.map(scoreTrace);
  const avg = (xs: number[]) =>
    xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
  const byBot: Record<string, number> = {};
  for (const bot of new Set(scores.map((s) => s.bot))) {
    byBot[bot] = avg(scores.filter((s) => s.bot === bot).map((s) => s.total));
  }
  const lost = METRICS.map((def) => ({
    id: def.id,
    pointsLost: avg(
      scores.map((s) => {
        const m = s.metrics.find((x) => x.id === def.id);
        return m ? m.max - m.points : 0;
      })
    ),
  }));
  lost.sort((a, b) => b.pointsLost - a.pointsLost);
  return {
    scores,
    mean: avg(scores.map((s) => s.total)),
    byBot,
    worst: lost[0],
  };
}
