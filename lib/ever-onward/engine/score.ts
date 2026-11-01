/**
 * The Engagement Scorecard: turns a simulator trace into 14 metrics (M1-M14),
 * a 0-100 total, and the worst metric and phase. The definitions, bands, gates
 * and weights come from
 * docs/superpowers/specs/2026-11-01-ever-onward-engagement-research.md
 * section 6; read that first. Where the doc was ambiguous, the choice made
 * here is noted next to the code.
 *
 * Sub-score of a value against a band: 1 inside it, falling linearly to 0 at
 * the fail edge. The fail edge is one band width beyond a two-sided band, 2x a
 * "at most" limit, half an "at least" limit, or the gate threshold when that is
 * closer. A metric's score is the mean of its phases' sub-scores weighted by
 * phase minutes, the worst phase counting double. Any failed gate caps the
 * total at 59.
 */
import { genericBots, type BotSet } from "./bots";
import { emberReward, prestigeUpgradeCost } from "./prestige";
import { simulate, type SimResult } from "./sim";
import {
  SOFT_BEAT_GAP,
  type NoveltyEvent,
  type PhaseSpan,
  type Trace,
  type TraceSample,
} from "./trace";
import type { UniverseDef, UniverseSave } from "./types";

const MIN = 60;
const HOUR = 3600;
const GATE_CAP = 59;
const WORST_PHASE_WEIGHT = 2;
/** Moments closer together than this are one beat (a phase start brings many). */
const SAME_BEAT = 1e-6;

// ------------------------------------------------------------------ numbers

export const mean = (values: readonly number[]): number =>
  values.length === 0
    ? 0
    : values.reduce((sum, v) => sum + v, 0) / values.length;

/** Percentile with linear interpolation, p in 0..1. */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * p;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  return sorted[low] + (sorted[high] - sorted[low]) * (position - low);
}

export const median = (values: readonly number[]): number =>
  percentile(values, 0.5);

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));
const share = (count: number, total: number): number =>
  total > 0 ? count / total : 0;

// -------------------------------------------------------------------- bands

/** A target band; `failLo` / `failHi` are where the sub-score reaches 0. */
export interface Band {
  lo?: number;
  hi?: number;
  failLo?: number;
  failHi?: number;
}

export function bandScore(value: number, band: Band): number {
  if (Number.isNaN(value)) return 0;
  const { lo, hi, failLo, failHi } = band;
  if (lo !== undefined && value < lo) {
    if (failLo === undefined || failLo >= lo) return 0;
    return clamp01((value - failLo) / (lo - failLo));
  }
  if (hi !== undefined && value > hi) {
    if (failHi === undefined || failHi <= hi) return 0;
    return clamp01((failHi - value) / (failHi - hi));
  }
  return 1;
}

/** At least `x`; fails at half of it, or at `gate` if that is closer. */
export const atLeast = (x: number, gate?: number): Band => ({
  lo: x,
  failLo: gate === undefined ? x / 2 : Math.max(x / 2, gate),
});

/** At most `x`; fails at twice it, or at `gate` if that is closer. */
export const atMost = (x: number, gate?: number): Band => ({
  hi: x,
  failHi: gate === undefined ? x * 2 : Math.min(x * 2, gate),
});

/** Between `lo` and `hi`; fails one band width outside, or at a gate. */
export function between(
  lo: number,
  hi: number,
  gateLo?: number,
  gateHi?: number
): Band {
  const width = hi - lo;
  return {
    lo,
    hi,
    failLo: gateLo === undefined ? lo - width : Math.max(lo - width, gateLo),
    failHi: gateHi === undefined ? hi + width : Math.min(hi + width, gateHi),
  };
}

// ------------------------------------------------------------------- report

export interface PhaseResult {
  phase: string;
  /** 0..1 */
  sub: number;
  gate: boolean;
  /** What failed, when it did. */
  gateDetail: string | null;
  /** A short human line with the numbers behind the sub-score. */
  headline: string;
  stats: Record<string, number>;
}

export interface MetricReport {
  id: string;
  name: string;
  weight: number;
  /** The target band, in words. */
  band: string;
  /** The gate, in words. */
  gate: string;
  /** Per phase, or a single entry labelled "run" for run-level metrics. */
  perPhase: PhaseResult[];
  isRunLevel: boolean;
  /** 0..1 */
  score: number;
  /** weight * score */
  points: number;
  gatePass: boolean;
}

export interface PhaseReport {
  id: string;
  minutes: number;
  /** 0..1, weighted by metric weight over the per-phase metrics. */
  score: number;
}

export interface RunInfo {
  tapperFinish: number | null;
  realisticFinish: number | null;
  idleFinish: number | null;
  run2Finish: number | null;
  run3Finish: number | null;
  phaseSeconds: number[];
}

export interface Scorecard {
  /** 0-100, after the gate cap. */
  total: number;
  /** 0-100 before the cap. */
  uncapped: number;
  isCapped: boolean;
  metrics: MetricReport[];
  phases: PhaseReport[];
  failingGates: string[];
  worstMetric: { id: string; name: string; pointsLost: number };
  worstPhase: { id: string; score: number };
  runs: RunInfo;
  /** Wall-clock milliseconds the simulations and scoring took. */
  runtimeMs: number;
}

// ------------------------------------------------------------------- inputs

export interface PhaseSkill {
  naive: SimResult;
  careful: SimResult;
  /** Run time at the phase's entry, where both bots started. */
  start: number;
  /** Same tending, bonus windows ignored versus claimed. */
  claim?: { ignores: SimResult; claims: SimResult };
}

/** Everything `scoreTrace` reads. `scoreUniverse` builds it by simulating. */
export interface ScoreInputs {
  /** The tapper bot, traced. */
  primary: SimResult;
  /**
   * The dawdler bot, traced: shops once a minute and taps lightly. M2 and M3
   * read its samples (a human doesn't buy the instant something is
   * affordable); every other metric reads the tapper.
   */
  dawdler?: SimResult;
  /** The realistic bot (untraced): reported, not scored. */
  realistic?: SimResult;
  /** The idle bot (untraced). */
  idle: SimResult;
  /**
   * Per phase index with a watched number: the naive and careful tenders
   * (and, where the phase has a bonus window, a bot that ignores it and one
   * that claims it), all started from the same state at the phase's entry and
   * stopped when it ends, so each gap is that phase's alone.
   */
  skill?: Record<number, PhaseSkill>;
  /** Prestige runs of the tapper bot; run 2 is traced. */
  run2: SimResult;
  run3: SimResult;
}

interface PhaseContext {
  def: UniverseDef;
  span: PhaseSpan;
  duration: number;
  samples: TraceSample[];
  purchases: Trace["purchases"];
  novelty: NoveltyEvent[];
  inputs: ScoreInputs;
  /** Seconds between trace samples. */
  sampleEvery: number;
}

type PhaseEval = (ctx: PhaseContext) => Omit<PhaseResult, "phase">;

interface MetricSpec {
  id: string;
  name: string;
  weight: number;
  band: string;
  gate: string;
}

const fmt = (n: number, digits = 0): string =>
  Number.isFinite(n) ? n.toFixed(digits) : n > 0 ? "inf" : "n/a";
const pct = (n: number): string => `${fmt(n * 100)}%`;
const subMean = (...subs: number[]): number => mean(subs);

/**
 * Distinct moments (a phase start brings many events at one time). A soft
 * event (a teaser, a later step of the same scene change) counts only when it
 * stands at least `SOFT_BEAT_GAP` seconds clear of the beat before it, so a
 * pile of them can't pad the cadence; a hard event always counts.
 */
export function beats(events: readonly NoveltyEvent[]): number[] {
  const hard = new Set(events.filter((e) => !e.isSoft).map((e) => e.t));
  const soft = new Set(events.filter((e) => e.isSoft).map((e) => e.t));
  const times = [...new Set([...hard, ...soft])].sort((a, b) => a - b);
  const counted: number[] = [];
  for (const t of times) {
    const last = counted[counted.length - 1];
    if (last !== undefined && t - last <= SAME_BEAT) continue;
    const isOnlySoft = !hard.has(t);
    if (isOnlySoft && last !== undefined && t - last < SOFT_BEAT_GAP) continue;
    counted.push(t);
  }
  return counted;
}

const gapsOf = (times: readonly number[]): number[] =>
  times.slice(1).map((t, i) => t - times[i]);

const meaningfulCount = (views: readonly { meaningful: boolean }[]): number =>
  views.filter((v) => v.meaningful).length;

// ------------------------------------------------------------------ M1 - M8

const M1: MetricSpec = {
  id: "M1",
  name: "Reveal cadence",
  weight: 10,
  band: "median gap 60-150 s, p10 >= 8 s, p90 <= 240 s, 8-25 reveals",
  gate: "max gap <= 180 s",
};
const evalM1: PhaseEval = ({ novelty }) => {
  const times = beats(novelty);
  const gaps = gapsOf(times);
  const med = median(gaps);
  const p10 = percentile(gaps, 0.1);
  const p90 = percentile(gaps, 0.9);
  const maxGap = gaps.length ? Math.max(...gaps) : Infinity;
  const sub = subMean(
    bandScore(med, between(60, 150)),
    bandScore(p10, atLeast(8)),
    bandScore(p90, atMost(240)),
    bandScore(times.length, between(8, 25))
  );
  const gate = maxGap <= 180;
  return {
    sub,
    gate,
    gateDetail: gate ? null : `max gap ${fmt(maxGap)} s > 180 s`,
    headline: `n ${times.length}, med ${fmt(med)}s, p10 ${fmt(p10)}s, max ${fmt(maxGap)}s`,
    stats: { count: times.length, median: med, p10, p90, maxGap },
  };
};

const M2: MetricSpec = {
  id: "M2",
  name: "Decision density",
  weight: 10,
  band: "1-2 options 45-75%, 3 <= 15%, 4+ <= 8%, 0 options 15-40%",
  gate: "4+ options <= 15% of the time",
};
const evalM2: PhaseEval = ({ samples }) => {
  const counts = samples.map((s) => meaningfulCount(s.affordable));
  const n = counts.length;
  const s0 = share(counts.filter((c) => c === 0).length, n);
  const s12 = share(counts.filter((c) => c === 1 || c === 2).length, n);
  const s3 = share(counts.filter((c) => c === 3).length, n);
  const s4 = share(counts.filter((c) => c >= 4).length, n);
  const sub = subMean(
    bandScore(s12, between(0.45, 0.75)),
    bandScore(s3, atMost(0.15)),
    bandScore(s4, atMost(0.08, 0.15)),
    bandScore(s0, between(0.15, 0.4))
  );
  const gate = s4 <= 0.15;
  return {
    sub,
    gate,
    gateDetail: gate ? null : `4+ options ${pct(s4)} > 15%`,
    headline: `0:${pct(s0)} 1-2:${pct(s12)} 3:${pct(s3)} 4+:${pct(s4)}`,
    stats: { s0, s12, s3, s4 },
  };
};

const M3: MetricSpec = {
  id: "M3",
  name: "Visible goal queue",
  weight: 3,
  band: "2-4 meaningful goals (greyed teasers included) visible >= 80% of the time",
  gate: "something meaningful to want (a goal, a teaser or an affordable buy) >= 95% of the time",
};
const evalM3: PhaseEval = ({ samples }) => {
  // A teaser is a goal the player can see and look forward to.
  const goalCounts = samples.map(
    (s) => meaningfulCount(s.goals) + s.teasers.length
  );
  const n = goalCounts.length;
  const inBand = share(goalCounts.filter((c) => c >= 2 && c <= 4).length, n);
  // Something to want: a goal, or a meaningful buy that is on screen now (a
  // player with the coins in hand has plenty to want).
  const wants = samples.map(
    (s, i) => goalCounts[i] + meaningfulCount(s.affordable)
  );
  const hasGoal = share(wants.filter((c) => c >= 1).length, n);
  const gate = hasGoal >= 0.95;
  return {
    sub: bandScore(inBand, atLeast(0.8)),
    gate,
    gateDetail: gate
      ? null
      : `something to want only ${pct(hasGoal)} of the time`,
    headline: `2-4 goals ${pct(inBand)}, something to want ${pct(hasGoal)}`,
    stats: { inBand, hasGoal },
  };
};

const M4: MetricSpec = {
  id: "M4",
  name: "Felt effect",
  weight: 10,
  band: "median meaningful effect >= 15% of income, filler <= 15% of buys",
  gate: "filler <= 25% of buys, median meaningful effect >= 8%",
};
const evalM4: PhaseEval = ({ purchases }) => {
  const meaningful = purchases.filter((p) => p.meaningful);
  const filler = share(purchases.length - meaningful.length, purchases.length);
  // Meaningful buys only: a mechanic or a scene change is felt without moving
  // income, and the doc's gate reads "median effect" without saying of what.
  const medEffect = meaningful.length
    ? median(meaningful.map((p) => p.effectRatio))
    : 0;
  const gate = purchases.length > 0 && filler <= 0.25 && medEffect >= 0.08;
  const sub = purchases.length
    ? subMean(
        bandScore(medEffect, atLeast(0.15, 0.08)),
        bandScore(filler, atMost(0.15, 0.25))
      )
    : 0;
  return {
    sub,
    gate,
    gateDetail: gate
      ? null
      : `filler ${pct(filler)}, median effect ${pct(medEffect)}`,
    headline: `buys ${purchases.length}, filler ${pct(filler)}, med effect ${pct(medEffect)}`,
    stats: { buys: purchases.length, filler, medEffect },
  };
};

const M5: MetricSpec = {
  id: "M5",
  name: "Purchase rate",
  weight: 6,
  band: "median 0.6-2.5 buys/min (rolling 5 min), p95 <= 5",
  gate: "p95 <= 8 buys/min",
};
const WINDOW = 5 * MIN;
const evalM5: PhaseEval = ({ span, purchases }) => {
  const first = Math.min(span.end, span.start + WINDOW);
  const rates: number[] = [];
  for (let t = first; t <= span.end + 1e-9; t += MIN) {
    const count = purchases.filter((p) => p.t > t - WINDOW && p.t <= t).length;
    rates.push(count / (Math.min(WINDOW, t - span.start) / MIN));
  }
  const med = median(rates);
  const p95 = percentile(rates, 0.95);
  const gate = !(p95 > 8);
  return {
    sub: subMean(
      bandScore(med, between(0.6, 2.5)),
      bandScore(p95, atMost(5, 8))
    ),
    gate,
    gateDetail: gate ? null : `p95 ${fmt(p95, 1)}/min > 8`,
    headline: `median ${fmt(med, 2)}/min, p95 ${fmt(p95, 2)}/min`,
    stats: { median: med, p95 },
  };
};

const M6: MetricSpec = {
  id: "M6",
  name: "Wait ratio",
  weight: 10,
  band: "median wait 20-90 s (first 10 min 10-45 s), ratio 0.8-1.5, p90 ratio <= 3, p95 wait <= 180 s",
  gate: "p95 wait <= 180 s",
};
const evalM6: PhaseEval = ({ span, purchases }) => {
  const times = purchases.filter((p) => p.meaningful).map((p) => p.t);
  if (times.length === 0)
    return {
      sub: 0,
      gate: false,
      gateDetail: "no meaningful purchase",
      headline: "no meaningful purchases",
      stats: {} as Record<string, number>,
    };
  const waits = times.map((t, i) => t - (i === 0 ? span.start : times[i - 1]));
  const early = waits.filter((_, i) => times[i] - span.start <= 10 * MIN);
  const ratios = waits
    .slice(1)
    .map((w, i) => (waits[i] > 0 ? w / waits[i] : NaN))
    .filter((r) => !Number.isNaN(r));
  const med = median(waits);
  const medEarly = early.length ? median(early) : Infinity;
  const medRatio = ratios.length ? median(ratios) : 1;
  const p90Ratio = ratios.length ? percentile(ratios, 0.9) : 1;
  const p95 = percentile(waits, 0.95);
  const gate = p95 <= 180;
  return {
    sub: subMean(
      bandScore(med, between(20, 90)),
      bandScore(medEarly, between(10, 45)),
      bandScore(medRatio, between(0.8, 1.5)),
      bandScore(p90Ratio, atMost(3)),
      bandScore(p95, atMost(180, 180))
    ),
    gate,
    gateDetail: gate ? null : `p95 wait ${fmt(p95)} s > 180 s`,
    headline: `med ${fmt(med)}s, early ${fmt(medEarly)}s, ratio ${fmt(medRatio, 2)}, p95 ${fmt(p95)}s`,
    stats: {
      median: med,
      medianEarly: medEarly,
      medianRatio: medRatio,
      p90Ratio,
      p95,
    },
  };
};

const M7: MetricSpec = {
  id: "M7",
  name: "Plates",
  weight: 10,
  band: "mean plates by quarter 1-2 / 2-3 / 3-5 / 4-6, peak >= 4",
  gate: "phases 1-3 reach >= 3 plates",
};
const QUARTER_BANDS: Band[] = [
  between(1, 2),
  between(2, 3),
  between(3, 5),
  between(4, 6),
];
const evalM7: PhaseEval = ({ span, duration, samples }) => {
  const quarter = (s: TraceSample): number =>
    Math.min(3, Math.floor(((s.t - span.start) / duration) * 4));
  const means = QUARTER_BANDS.map((_, q) =>
    mean(samples.filter((s) => quarter(s) === q).map((s) => s.plates.length))
  );
  const peak = Math.max(0, ...samples.map((s) => s.plates.length));
  const gate = span.index > 2 || peak >= 3;
  const sub = subMean(
    ...QUARTER_BANDS.map((band, q) => bandScore(means[q], band)),
    bandScore(peak, atLeast(4))
  );
  return {
    sub,
    gate,
    gateDetail: gate ? null : `peak ${peak} plates < 3`,
    headline: `Q ${means.map((m) => fmt(m, 1)).join("/")}, peak ${peak}`,
    stats: { q1: means[0], q2: means[1], q3: means[2], q4: means[3], peak },
  };
};

const M8: MetricSpec = {
  id: "M8",
  name: "Novelty per phase",
  weight: 7,
  band: ">= 1 new mechanic, resource, scene layer and plate, >= 6 novelty beats",
  gate: ">= 1 new mechanic in each phase",
};
const evalM8: PhaseEval = ({ novelty }) => {
  const count = (pick: (e: NoveltyEvent) => boolean): number =>
    novelty.filter(pick).length;
  const mechanics = count(
    (e) =>
      e.kind === "action" ||
      (e.kind === "upgrade" && e.upgradeKind === "mechanic")
  );
  const resources = count((e) => e.kind === "resource");
  const scenes = count((e) => e.kind === "scene");
  const plates = count((e) => e.kind === "plate");
  const total = beats(novelty).length;
  const sub = mean([
    clamp01(mechanics / 1),
    clamp01(resources / 1),
    clamp01(scenes / 1),
    clamp01(plates / 1),
    clamp01(total / 6),
  ]);
  const gate = mechanics >= 1;
  return {
    sub,
    gate,
    gateDetail: gate ? null : "no new mechanic",
    headline: `mech ${mechanics}, res ${resources}, scene ${scenes}, plate ${plates}, beats ${total}`,
    stats: { mechanics, resources, scenes, plates, beats: total },
  };
};

// ------------------------------------------------------------------- M9, M10

const M9: MetricSpec = {
  id: "M9",
  name: "Tension",
  weight: 6,
  band: "watched number low 10-35% of the time, empty <= 3%, the careful tender beats the naive one by 5-25% (per phase, both started from the same state; the claim gap is reported, not scored)",
  gate: "consumable empty <= 8% of the time",
};
const LOW_ZONE = { lo: 0.05, hi: 0.3 };

/** Seconds the bot spent in the phase it was started at the entry of. */
function phaseSeconds(result: SimResult | undefined, start: number): number {
  return result ? result.endTime - start : NaN;
}

/** How much longer the slower bot took than the quicker one (0.1 = 10%). */
const gapOf = (slow: number, quick: number): number => slow / quick - 1;

const evalM9: PhaseEval = ({ def, span, samples, inputs }) => {
  const levelsOf = (id: string): number[] =>
    samples
      .map((s) => s.consumables[id])
      .filter((l): l is number => l !== null && l !== undefined);
  const consumable = def.consumables?.find((c) => levelsOf(c.id).length > 0);
  const levels = consumable ? levelsOf(consumable.id) : [];
  const zone = consumable?.lowZone ?? LOW_ZONE;
  if (levels.length === 0)
    return {
      sub: 0,
      gate: true,
      gateDetail: null,
      headline: "no watched number in this phase",
      stats: { low: 0, empty: 0, skill: 0, claimGap: 0 },
    };
  const low = share(
    levels.filter((l) => l >= zone.lo && l <= zone.hi).length,
    levels.length
  );
  const empty = share(levels.filter((l) => l <= 1e-6).length, levels.length);
  const pair = inputs.skill?.[span.index];
  const skill = pair
    ? gapOf(
        phaseSeconds(pair.naive, pair.start),
        phaseSeconds(pair.careful, pair.start)
      )
    : NaN;
  const claimGap = pair?.claim
    ? gapOf(
        phaseSeconds(pair.claim.ignores, pair.start),
        phaseSeconds(pair.claim.claims, pair.start)
      )
    : NaN;
  const gate = empty <= 0.08;
  return {
    sub: subMean(
      bandScore(low, between(0.1, 0.35)),
      bandScore(empty, atMost(0.03, 0.08)),
      bandScore(skill, between(0.05, 0.25))
    ),
    gate,
    gateDetail: gate ? null : `empty ${pct(empty)} > 8%`,
    headline: `low ${pct(low)}, empty ${pct(empty)}, tend gap ${fmt(skill * 100, 1)}%${
      Number.isNaN(claimGap) ? "" : `, claim gap ${fmt(claimGap * 100, 1)}%`
    }`,
    stats: { low, empty, skill, claimGap },
  };
};

const M10: MetricSpec = {
  id: "M10",
  name: "Income smoothness",
  weight: 4,
  band: "0.04-0.20 decades/min, slope CV <= 0.7, plateau share <= 10% (last phase reads the flame: slope -0.04 to 0.05 of full a minute, full <= 10% of the time)",
  gate: "plateau share <= 20%",
};
const SLOPE_SPAN = 3;
const evalM10: PhaseEval = ({ def, span, samples, sampleEvery }) => {
  const levelsOf = (id: string): number[] =>
    samples
      .map((s) => s.consumables[id])
      .filter((l): l is number => l !== null && l !== undefined);
  // 60 s windows; the first is skipped (income resets at a phase change).
  const windows: number[] = [];
  for (let k = 1; span.start + (k + 1) * MIN <= span.end + 1e-9; k += 1) {
    const inWindow = samples.filter(
      (s) => s.t >= span.start + k * MIN && s.t < span.start + (k + 1) * MIN
    );
    if (inWindow.length)
      windows.push(mean(inWindow.map((s) => s.autoRate + s.manualRate)));
  }
  const logs = windows.map((w) => Math.log10(Math.max(w, 1e-6)));
  if (logs.length < SLOPE_SPAN + 2)
    return {
      sub: 0,
      gate: true,
      gateDetail: null,
      headline: "phase too short to measure",
      stats: {} as Record<string, number>,
    };
  const n = logs.length;
  const meanX = (n - 1) / 2;
  const meanY = mean(logs);
  const slope =
    logs.reduce((sum, y, x) => sum + (x - meanX) * (y - meanY), 0) /
    logs.reduce((sum, _, x) => sum + (x - meanX) ** 2, 0);
  const local = logs
    .slice(SLOPE_SPAN)
    .map((y, i) => (y - logs[i]) / SLOPE_SPAN);
  const meanLocal = mean(local);
  const sd = Math.sqrt(mean(local.map((d) => (d - meanLocal) ** 2)));
  const cv = Math.abs(meanLocal) > 1e-9 ? sd / Math.abs(meanLocal) : Infinity;
  const flat = windows
    .slice(2)
    .filter((w, i) => w / Math.max(windows[i], 1e-9) < 1.05).length;
  const plateau = share(flat, Math.max(1, windows.length - 2));
  if (span.index === def.phases.length - 1) {
    // The last phase is about a flame, not income: read the watched number
    // itself. It must hover (a slope near zero, either way), never run away
    // upward, and not sit full.
    const flame = def.consumables?.find((c) => levelsOf(c.id).length > 0);
    const levels = flame ? levelsOf(flame.id) : [];
    if (levels.length >= SLOPE_SPAN + 2) {
      const lx = (levels.length - 1) / 2;
      const ly = mean(levels);
      const trend =
        levels.reduce((sum, y, x) => sum + (x - lx) * (y - ly), 0) /
        levels.reduce((sum, _, x) => sum + (x - lx) ** 2, 0);
      // samples are `sampleEvery` apart; express the slope per minute
      const perMinute = (trend * MIN) / sampleEvery;
      const full = share(levels.filter((l) => l >= 0.97).length, levels.length);
      const gate = full <= 0.2 && perMinute <= 0.08;
      return {
        sub: subMean(
          bandScore(perMinute, between(-0.04, 0.05)),
          bandScore(full, atMost(0.1, 0.2))
        ),
        gate,
        gateDetail: gate
          ? null
          : `flame full ${pct(full)} (max 20%), slope ${fmt(perMinute, 3)}/min (max 0.08)`,
        headline: `flame slope ${fmt(perMinute, 3)}/min (band -0.04 to 0.05), full ${pct(full)}`,
        stats: { slope: perMinute, cv: 0, plateau: full },
      };
    }
  }
  const gate = plateau <= 0.2;
  return {
    sub: subMean(
      bandScore(slope, between(0.04, 0.2)),
      bandScore(cv, atMost(0.7)),
      bandScore(plateau, atMost(0.1, 0.2))
    ),
    gate,
    gateDetail: gate ? null : `plateau share ${pct(plateau)} > 20%`,
    headline: `slope ${fmt(slope, 3)}/min, cv ${fmt(cv, 2)}, plateau ${pct(plateau)}`,
    stats: { slope, cv, plateau },
  };
};

// ------------------------------------------------------------------- M12

const M12: MetricSpec = {
  id: "M12",
  name: "Dead time",
  weight: 4,
  band: "longest stretch without a meaningful event <= 150 s, p95 gap <= 100 s",
  gate: "longest <= 180 s, and the shop (teasers included) is never empty more than 3% of the time",
};
const evalM12: PhaseEval = ({ span, novelty, purchases, samples }) => {
  const times = [
    span.start,
    ...beats(novelty),
    ...purchases.filter((p) => p.meaningful).map((p) => p.t),
    span.end,
  ].sort((a, b) => a - b);
  const gaps = gapsOf(times);
  const longest = Math.max(0, ...gaps);
  const p95 = percentile(gaps, 0.95);
  // The tapper buys the moment it can, so an empty shop is a real hole: the
  // player looks at nothing, not even a greyed card to look forward to.
  const empty = share(
    samples.filter((s) => s.visible.length === 0 && s.teasers.length === 0)
      .length,
    samples.length
  );
  const gate = longest <= 180 && empty <= 0.03;
  return {
    sub: subMean(
      bandScore(longest, atMost(150, 180)),
      bandScore(p95, atMost(100)),
      bandScore(empty, atMost(0.03, 0.1))
    ),
    gate,
    gateDetail: gate
      ? null
      : `longest ${fmt(longest)} s (max 180), empty shop ${pct(empty)} (max 3%)`,
    headline: `longest ${fmt(longest)}s, p95 ${fmt(p95)}s, empty shop ${pct(empty)}`,
    stats: { longest, p95, empty },
  };
};

// ------------------------------------------------------------------- M15

const M15: MetricSpec = {
  id: "M15",
  name: "Chore rate",
  weight: 4,
  band: "0.3-4 non-tap clicks per active minute (buying oil, steering, claiming)",
  gate: "<= 8 non-tap clicks per active minute, and a phase's busiest minute <= 20",
};
const evalM15: PhaseEval = ({ span, inputs }) => {
  const clicks = inputs.primary.actionsDone.filter(
    (a) => a.t >= span.start && a.t < span.end
  );
  const minutes = Math.max(1, span.end - span.start) / MIN;
  const rate = clicks.length / minutes;
  const perMinute = new Map<number, number>();
  for (const a of clicks) {
    const m = Math.floor((a.t - span.start) / MIN);
    perMinute.set(m, (perMinute.get(m) ?? 0) + 1);
  }
  const busiest = Math.max(0, ...perMinute.values());
  const gate = rate <= 8 && busiest <= 20;
  return {
    sub: subMean(
      bandScore(rate, between(0.3, 4, undefined, 8)),
      bandScore(busiest, atMost(10, 20))
    ),
    gate,
    gateDetail: gate
      ? null
      : `${fmt(rate, 1)} clicks/min (max 8), busiest minute ${busiest} (max 20)`,
    headline: `${fmt(rate, 2)} non-tap clicks/min, busiest minute ${busiest}`,
    stats: { rate, busiest, clicks: clicks.length },
  };
};

// ---------------------------------------------------------- run-level M11, 13, 14

const M11: MetricSpec = {
  id: "M11",
  name: "Active vs idle",
  weight: 7,
  band: "manual share >= 70% at min 1-3, 20-50% at min 10-20, 10-35% late (never 0, <= 60% after min 20); idle/tapper finish 1.25-2.5x",
  gate: "idle finishes within 4 h and ratio >= 1.15",
};
const manualShare = (s: TraceSample): number => {
  const total = s.manualRate + s.autoRate;
  return total > 0 ? s.manualRate / total : NaN;
};
const shareOver = (samples: readonly TraceSample[], from: number, to: number) =>
  mean(
    samples
      .filter((s) => s.t >= from && s.t < to)
      .map(manualShare)
      .filter((v) => !Number.isNaN(v))
  );

function evalM11(def: UniverseDef, inputs: ScoreInputs): PhaseResult {
  void def;
  const { samples } = inputs.primary.trace!;
  const end = inputs.primary.endTime;
  const early = shareOver(samples, 1 * MIN, 3 * MIN);
  const mid = shareOver(samples, 10 * MIN, 20 * MIN);
  const late = shareOver(samples, (end * 2) / 3, end + 1);
  const after20 = samples
    .filter((s) => s.t >= 20 * MIN)
    .map(manualShare)
    .filter((v) => !Number.isNaN(v));
  const maxAfter20 = after20.length ? Math.max(...after20) : 0;
  const minShare = Math.min(
    ...samples
      .filter((s) => s.t >= MIN)
      .map(manualShare)
      .filter((v) => !Number.isNaN(v))
  );
  const tapperFinish = inputs.primary.finishTime ?? Infinity;
  const idleFinish = inputs.idle.finishTime ?? Infinity;
  const ratio = idleFinish / tapperFinish;
  const gate = idleFinish <= 4 * HOUR && ratio >= 1.15;
  const shares = mean([
    bandScore(early, atLeast(0.7)),
    bandScore(mid, between(0.2, 0.5)),
    bandScore(late, between(0.1, 0.35)),
    bandScore(maxAfter20, atMost(0.6, 1)),
    bandScore(minShare, atLeast(0.005)),
  ]);
  return {
    phase: "run",
    sub: 0.5 * shares + 0.5 * bandScore(ratio, between(1.25, 2.5, 1.15)),
    gate,
    gateDetail: gate
      ? null
      : `idle finish ${fmt(idleFinish / HOUR, 2)} h, ratio ${fmt(ratio, 2)}`,
    headline: `manual early ${pct(early)} mid ${pct(mid)} late ${pct(late)}, idle/tapper ${fmt(ratio, 2)}x`,
    stats: { early, mid, late, maxAfter20, minShare, ratio },
  };
}

const M13: MetricSpec = {
  id: "M13",
  name: "Prestige speedup",
  weight: 5,
  band: "run2/run1 0.50-0.70, run3/run2 0.75-0.95, early reveals >= 60% of run 1",
  gate: "run2 < run1 and run2/run1 >= 0.40",
};
const earlyBeats = (trace: Trace): number =>
  beats(trace.novelty.filter((e) => e.t < 15 * MIN)).length;

function evalM13(inputs: ScoreInputs): PhaseResult {
  const f1 = inputs.primary.finishTime ?? Infinity;
  const f2 = inputs.run2.finishTime ?? Infinity;
  const f3 = inputs.run3.finishTime ?? Infinity;
  const r21 = f2 / f1;
  const r32 = f3 / f2;
  const early = share(
    earlyBeats(inputs.run2.trace!),
    earlyBeats(inputs.primary.trace!)
  );
  const gate = f2 < f1 && r21 >= 0.4;
  return {
    phase: "run",
    sub: subMean(
      bandScore(r21, between(0.5, 0.7, 0.4)),
      bandScore(r32, between(0.75, 0.95)),
      bandScore(early, atLeast(0.6))
    ),
    gate,
    gateDetail: gate ? null : `run2/run1 ${fmt(r21, 2)}`,
    headline: `run2/run1 ${fmt(r21, 2)}, run3/run2 ${fmt(r32, 2)}, early reveals ${pct(early)}`,
    stats: { r21, r32, early },
  };
}

const M14: MetricSpec = {
  id: "M14",
  name: "Total length",
  weight: 4,
  band: "2.0-3.0 h",
  gate: "1.5-4 h",
};

function evalM14(inputs: ScoreInputs): PhaseResult {
  const finish = inputs.primary.finishTime ?? Infinity;
  const gate = finish >= 1.5 * HOUR && finish <= 4 * HOUR;
  return {
    phase: "run",
    sub: bandScore(finish, between(2 * HOUR, 3 * HOUR, 1.5 * HOUR, 4 * HOUR)),
    gate,
    gateDetail: gate ? null : `${fmt(finish / HOUR, 2)} h outside 1.5-4 h`,
    headline: `${fmt(finish / HOUR, 2)} h`,
    stats: { hours: finish / HOUR },
  };
}

// -------------------------------------------------------------------- combine

const PHASE_METRICS: readonly [MetricSpec, PhaseEval][] = [
  [M1, evalM1],
  [M2, evalM2],
  [M3, evalM3],
  [M4, evalM4],
  [M5, evalM5],
  [M6, evalM6],
  [M7, evalM7],
  [M8, evalM8],
  [M9, evalM9],
  [M10, evalM10],
  [M12, evalM12],
  [M15, evalM15],
];

/** Metrics read from the dawdler's trace instead of the tapper's. */
const DAWDLER_METRICS: ReadonlySet<string> = new Set(["M2", "M3"]);

/** Phase minutes as weights, the worst phase counting double. */
export function combinePhases(
  subs: readonly number[],
  durations: readonly number[]
): number {
  const worst = subs.indexOf(Math.min(...subs));
  const weights = durations.map((d, i) =>
    i === worst ? d * WORST_PHASE_WEIGHT : d
  );
  const total = weights.reduce((a, b) => a + b, 0);
  return total > 0
    ? subs.reduce((sum, s, i) => sum + s * weights[i], 0) / total
    : mean(subs);
}

function report(
  spec: MetricSpec,
  perPhase: PhaseResult[],
  score: number,
  isRunLevel: boolean
): MetricReport {
  return {
    ...spec,
    perPhase,
    isRunLevel,
    score,
    points: spec.weight * score,
    gatePass: perPhase.every((p) => p.gate),
  };
}

/** Scores simulations that have already been run. Pure. */
export function scoreTrace(def: UniverseDef, inputs: ScoreInputs): Scorecard {
  const started = Date.now();
  const trace = inputs.primary.trace;
  if (!trace) throw new Error("scoreTrace needs a traced primary run");
  if (!inputs.run2.trace) throw new Error("scoreTrace needs a traced run 2");
  const spans = trace.phases;
  const durations = spans.map((s) => Math.max(1, s.end - s.start) / MIN);

  const metrics: MetricReport[] = [];
  const contextsOf = (source: Trace): PhaseContext[] =>
    source.phases.map((span, i, all) => ({
      def,
      span,
      duration: Math.max(1, span.end - span.start),
      samples: source.samples.filter((s) => s.phase === span.index),
      purchases: source.purchases.filter((p) => p.phase === span.index),
      novelty: source.novelty.filter(
        (e) =>
          e.t >= span.start && (i === all.length - 1 ? true : e.t < span.end)
      ),
      inputs,
      sampleEvery: source.sampleEvery,
    }));
  const contexts = contextsOf(trace);
  const dawdlerSource = inputs.dawdler?.trace
    ? contextsOf(inputs.dawdler.trace)
    : contexts;
  // A dawdler that never reaches the last phase can't be scored per phase.
  const dawdlerContexts =
    dawdlerSource.length === contexts.length ? dawdlerSource : contexts;

  for (const [spec, evaluate] of PHASE_METRICS) {
    const source = DAWDLER_METRICS.has(spec.id) ? dawdlerContexts : contexts;
    const perPhase = source.map((ctx) => ({
      phase: ctx.span.id,
      ...evaluate(ctx),
    }));
    const score = combinePhases(
      perPhase.map((p) => p.sub),
      durations
    );
    metrics.push(report(spec, perPhase, score, false));
  }
  const runLevel: [MetricSpec, PhaseResult][] = [
    [M11, evalM11(def, inputs)],
    [M13, evalM13(inputs)],
    [M14, evalM14(inputs)],
  ];
  for (const [spec, result] of runLevel)
    metrics.push(report(spec, [result], result.sub, true));
  metrics.sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));

  const uncapped = metrics.reduce((sum, m) => sum + m.points, 0);
  const failingGates = metrics.flatMap((m) =>
    m.perPhase
      .filter((p) => !p.gate)
      .map((p) => `${m.id} ${m.name} (${p.phase}): ${p.gateDetail ?? m.gate}`)
  );
  const isCapped = failingGates.length > 0 && uncapped > GATE_CAP;

  const phaseMetrics = metrics.filter((m) => !m.isRunLevel);
  const totalWeight = phaseMetrics.reduce((sum, m) => sum + m.weight, 0);
  const phases: PhaseReport[] = spans.map((span, i) => ({
    id: span.id,
    minutes: durations[i],
    score:
      phaseMetrics.reduce((sum, m) => sum + m.weight * m.perPhase[i].sub, 0) /
      totalWeight,
  }));
  const worstPhase = phases.reduce((a, b) => (b.score < a.score ? b : a));
  const worstMetric = metrics.reduce((a, b) =>
    b.weight - b.points > a.weight - a.points ? b : a
  );

  return {
    total: isCapped ? GATE_CAP : uncapped,
    uncapped,
    isCapped,
    metrics,
    phases,
    failingGates,
    worstMetric: {
      id: worstMetric.id,
      name: worstMetric.name,
      pointsLost: worstMetric.weight - worstMetric.points,
    },
    worstPhase: { id: worstPhase.id, score: worstPhase.score },
    runs: {
      tapperFinish: inputs.primary.finishTime,
      realisticFinish: inputs.realistic?.finishTime ?? null,
      idleFinish: inputs.idle.finishTime,
      run2Finish: inputs.run2.finishTime,
      run3Finish: inputs.run3.finishTime,
      phaseSeconds: spans.map((s) => s.end - s.start),
    },
    runtimeMs: Date.now() - started,
  };
}

// ------------------------------------------------------------------ simulate

export interface ScoreOptions {
  bots?: BotSet;
  /** Seconds per simulated step (default 1). */
  step?: number;
}

/** Embers a typical player has after `runs` finished runs, spent cheapest-first. */
export function typicalPrestige(
  def: UniverseDef,
  embersEarned: number
): Record<string, number> {
  const save = { prestigeUpgrades: {} } as UniverseSave;
  let embers = embersEarned;
  for (let guard = 0; guard < 200; guard += 1) {
    const options = def.prestige.upgrades
      .map((u) => ({ id: u.id, cost: prestigeUpgradeCost(def, save, u.id) }))
      .filter((o): o is { id: string; cost: number } => o.cost !== null)
      .filter((o) => o.cost <= embers)
      .sort((a, b) => a.cost - b.cost);
    if (options.length === 0) break;
    const pick = options[0];
    embers -= pick.cost;
    save.prestigeUpgrades[pick.id] = (save.prestigeUpgrades[pick.id] ?? 0) + 1;
  }
  return save.prestigeUpgrades;
}

const MAX_SECONDS = 8 * HOUR;

/** Plays every bot, then scores the universe. */
export function scoreUniverse(
  def: UniverseDef,
  options: ScoreOptions = {}
): Scorecard {
  const started = Date.now();
  const bots = options.bots ?? genericBots();
  const step = options.step ?? 1;
  const base = { maxSeconds: MAX_SECONDS, step };

  const primary = simulate(def, {
    ...base,
    strategy: bots.tapper,
    trace: { sampleEvery: 5 },
  });
  const consumablePhases = [
    ...new Set(
      primary
        .trace!.samples.filter((s) =>
          Object.values(s.consumables).some((l) => l !== null)
        )
        .map((s) => s.phase)
    ),
  ];
  const skill: NonNullable<ScoreInputs["skill"]> = {};
  consumablePhases.forEach((index, i) => {
    const pair =
      bots.skill?.[index] ??
      (i === 0
        ? { naive: bots.naiveOil, careful: bots.cheapskateOil }
        : undefined);
    if (!pair) return;
    // Every pair starts from the same state at the phase's entry, so each gap
    // belongs to that phase alone (not the sum of what came before).
    const entry =
      index === 0
        ? undefined
        : simulate(def, {
            ...base,
            strategy: bots.tapper,
            stopWhen: (run) => run.phase >= index,
          }).finalRun;
    const from = {
      ...base,
      startRun: entry,
      stopWhen: (run: { phase: number }) => run.phase > index,
    };
    const claimPair = bots.claim?.[index];
    skill[index] = {
      naive: simulate(def, { ...from, strategy: pair.naive }),
      careful: simulate(def, { ...from, strategy: pair.careful }),
      start: entry?.time ?? 0,
      claim: claimPair
        ? {
            ignores: simulate(def, { ...from, strategy: claimPair.ignores }),
            claims: simulate(def, { ...from, strategy: claimPair.claims }),
          }
        : undefined,
    };
  });

  const embers = emberReward(def, primary.finalRun);
  const run2 = simulate(def, {
    ...base,
    strategy: bots.tapper,
    prestige: typicalPrestige(def, embers),
    trace: { sampleEvery: 5 },
  });
  const run3 = simulate(def, {
    ...base,
    strategy: bots.tapper,
    prestige: typicalPrestige(def, embers + emberReward(def, run2.finalRun)),
  });

  const dawdler = simulate(def, {
    ...base,
    strategy: bots.dawdler,
    trace: { sampleEvery: 5 },
  });
  const card = scoreTrace(def, {
    primary,
    realistic: simulate(def, { ...base, strategy: bots.realistic }),
    idle: simulate(def, { ...base, strategy: bots.idle }),
    dawdler,
    skill,
    run2,
    run3,
  });
  return { ...card, runtimeMs: Date.now() - started };
}
