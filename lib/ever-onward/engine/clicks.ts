/**
 * The click curve: how much of a phase's income comes from tapping, minute by
 * minute of that phase, and how often the player clicks. A Paperclips-shaped
 * phase opens hands-on (taps are most of the income for a few minutes), then
 * the helpers take over and a tap becomes a nudge. M11 scores this curve.
 */
import type { SimResult } from "./sim";
import type { TraceSample } from "./trace";

const MIN = 60;

/** From this minute of a phase on, tapping should be a nudge. */
export const LATE_FROM_MINUTE = 6;
/** The phase's opening, where taps should carry the income. */
export const EARLY_FROM_MINUTE = 0.5;
export const EARLY_TO_MINUTE = 3;

export interface ClickMinute {
  /** Mean share of income from taps over this minute of the phase (0..1). */
  manualShare: number;
  tapsPerMinute: number;
  /** Other buttons pressed (oil, steering, side machines, greetings). */
  actionsPerMinute: number;
}

export interface PhaseClicks {
  phase: string;
  index: number;
  minutes: ClickMinute[];
  /** Mean manual share over minutes 0.5-3 of the phase. */
  early: number;
  /** Mean manual share from minute 6 to the phase's end (NaN if shorter). */
  late: number;
  /** Lowest manual share after the first minute (a tap must always earn). */
  lowest: number;
  /**
   * The same low point, as the share 3 taps a second would earn there: the
   * never-stuck floor, read at a fixed pace so a lazy bot can't fail it and
   * an eager one can't pass it by tapping harder. NaN when nothing was seen.
   */
  lowestAtThree: number;
  lateTapsPerMinute: number;
  lateActionsPerMinute: number;
}

export const manualShareOf = (s: TraceSample): number => {
  const total = s.manualRate + s.autoRate;
  return total > 0 ? s.manualRate / total : NaN;
};

/** The pace the never-stuck floor is read at. */
const FLOOR_TAPS = 3;

/** Share of income 3 taps a second would earn at this sample (NaN: not tapping). */
export const shareAtThreeOf = (s: TraceSample): number => {
  if (!(s.tapsPerSecond > 0)) return NaN;
  const hard = (s.manualRate / s.tapsPerSecond) * FLOOR_TAPS;
  return hard + s.autoRate > 0 ? hard / (hard + s.autoRate) : NaN;
};

/** The smallest real value, or NaN when there is none (never Infinity). */
const lowestOf = (values: readonly number[]): number => {
  const real = values.filter((v) => !Number.isNaN(v));
  return real.length ? Math.min(...real) : NaN;
};

const meanOf = (values: readonly number[]): number => {
  const real = values.filter((v) => !Number.isNaN(v));
  return real.length ? real.reduce((sum, v) => sum + v, 0) / real.length : NaN;
};

/** The per-phase click curve of a traced run. */
export function clickCurve(result: SimResult): PhaseClicks[] {
  const trace = result.trace;
  if (!trace) throw new Error("clickCurve needs a traced run");
  return trace.phases.map((span) => {
    const samples = trace.samples.filter((s) => s.phase === span.index);
    const actions = result.actionsDone.filter(
      (a) => a.t >= span.start && a.t < span.end
    );
    const between = (from: number, to: number) =>
      samples.filter((s) => s.sinceEntry >= from && s.sinceEntry < to);
    const tapsPerMinute = (picked: readonly TraceSample[]): number =>
      meanOf(picked.map((s) => s.tapsPerSecond)) * MIN;
    const length = span.end - span.start;
    const minutes: ClickMinute[] = [];
    for (let m = 0; m * MIN < length; m += 1) {
      const picked = between(m * MIN, (m + 1) * MIN);
      minutes.push({
        manualShare: meanOf(picked.map(manualShareOf)),
        tapsPerMinute: tapsPerMinute(picked),
        actionsPerMinute: actions.filter(
          (a) => a.t - span.start >= m * MIN && a.t - span.start < (m + 1) * MIN
        ).length,
      });
    }
    const late = between(LATE_FROM_MINUTE * MIN, Infinity);
    const afterFirst = between(MIN, Infinity);
    const floorSamples = afterFirst.length ? afterFirst : samples;
    const lateMinutes = Math.max(0, length / MIN - LATE_FROM_MINUTE);
    return {
      phase: span.id,
      index: span.index,
      minutes,
      early: meanOf(
        between(EARLY_FROM_MINUTE * MIN, EARLY_TO_MINUTE * MIN).map(
          manualShareOf
        )
      ),
      late: meanOf(late.map(manualShareOf)),
      // After the first minute; a phase shorter than that is read whole, so
      // the floor is never passed for want of samples.
      lowest: lowestOf(floorSamples.map(manualShareOf)),
      lowestAtThree: lowestOf(floorSamples.map(shareAtThreeOf)),
      lateTapsPerMinute: late.length ? tapsPerMinute(late) : NaN,
      lateActionsPerMinute:
        lateMinutes > 0
          ? actions.filter((a) => a.t - span.start >= LATE_FROM_MINUTE * MIN)
              .length / lateMinutes
          : NaN,
    };
  });
}

/** One line per phase: the manual share (percent) minute by minute. */
export function formatCurve(curve: readonly PhaseClicks[]): string[] {
  return curve.map((p) => {
    const shares = p.minutes
      .map((m) =>
        Number.isNaN(m.manualShare)
          ? "  -"
          : String(Math.round(m.manualShare * 100)).padStart(3)
      )
      .join("");
    return `${p.phase.padEnd(7)}${shares}`;
  });
}
