/**
 * Decision gaps: how long the player goes with nothing meaningful to decide.
 * A decision is a meaningful purchase, a project started, or an action the
 * universe tags as a real choice (`UniverseDef.decisionActions`: where to
 * send a crew, which route to fly, a knob's setting). Claims, fixes, collects
 * and story lines never count, so a phase full of beats but empty of choices
 * reads as the wait it is. Read from the player who taps when it helps, the
 * scorecard's most human bot.
 */
import type { SimResult } from "./sim";
import type { UniverseDef } from "./types";

const MIN = 60;

/** The opening of a phase (the cutscene, the first taps) is not scored. */
export const DECISION_OPENING_SECONDS = 2 * MIN;
/** Gaps longer than this are listed by name in the report. */
export const LONG_GAP_SECONDS = 60;

export interface DecisionGap {
  /** Seconds into the phase the stretch began. */
  from: number;
  seconds: number;
}

export interface PhaseDecisions {
  phase: string;
  index: number;
  /** Decision moments in the scored part of the phase. */
  count: number;
  /** Decisions a minute over the scored part. */
  perMinute: number;
  longest: number;
  /** Seconds into the phase the longest gap began. */
  longestFrom: number;
  p90: number;
  /** Every gap over `LONG_GAP_SECONDS`, in order. */
  long: DecisionGap[];
  /** Share of the scored part spent in those long gaps (0..1). */
  deadShare: number;
  /**
   * Seconds since the last decision at the end of each minute of the phase
   * (the curve the report prints; the opening is included for reference).
   */
  sinceLast: number[];
  /** Decision moments by kind, over the whole phase. */
  kinds: { buys: number; projects: number; actions: number };
}

function percentileOf(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * p;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  return sorted[low] + (sorted[high] - sorted[low]) * (position - low);
}

/** The per-phase decision gaps of a traced run. */
export function decisionGaps(
  def: UniverseDef,
  result: SimResult
): PhaseDecisions[] {
  const trace = result.trace;
  if (!trace) throw new Error("decisionGaps needs a traced run");
  const tagged = new Set(def.decisionActions ?? []);
  return trace.phases.map((span) => {
    const inSpan = (t: number) => t >= span.start && t <= span.end;
    const buys = trace.purchases
      .filter((p) => p.phase === span.index && p.meaningful)
      .map((p) => p.t);
    const projects = (result.projectsDone ?? []).map((p) => p.t).filter(inSpan);
    const actions = result.actionsDone
      .filter((a) => tagged.has(a.id) && inSpan(a.t))
      .map((a) => a.t);
    const all = [...new Set([...buys, ...projects, ...actions])].sort(
      (a, b) => a - b
    );
    const scoredFrom = Math.min(
      span.end,
      span.start + DECISION_OPENING_SECONDS
    );
    const scored = all.filter((t) => t >= scoredFrom);
    // The stretch running into the scored part counts from the last decision
    // before it (or the scored start, whichever is later): a gap that began
    // in the opening is still a gap once the opening is over.
    const before = all.filter((t) => t < scoredFrom).at(-1);
    const marks = [Math.max(scoredFrom, before ?? scoredFrom), ...scored];
    if (marks.at(-1)! < span.end) marks.push(span.end);
    const gaps: DecisionGap[] = marks.slice(1).map((t, i) => ({
      from: marks[i] - span.start,
      seconds: t - marks[i],
    }));
    const longestGap = gaps.reduce<DecisionGap>(
      (best, g) => (g.seconds > best.seconds ? g : best),
      { from: 0, seconds: 0 }
    );
    const scoredMinutes = Math.max(1, span.end - scoredFrom) / MIN;
    const sinceLast: number[] = [];
    for (let m = 1; span.start + (m - 1) * MIN < span.end; m += 1) {
      const at = Math.min(span.end, span.start + m * MIN);
      const last = all.filter((t) => t <= at).at(-1) ?? span.start;
      sinceLast.push(at - last);
    }
    return {
      phase: span.id,
      index: span.index,
      count: scored.length,
      perMinute: scored.length / scoredMinutes,
      longest: longestGap.seconds,
      longestFrom: longestGap.from,
      p90: percentileOf(
        gaps.map((g) => g.seconds),
        0.9
      ),
      long: gaps.filter((g) => g.seconds > LONG_GAP_SECONDS),
      deadShare:
        gaps
          .filter((g) => g.seconds > LONG_GAP_SECONDS)
          .reduce((sum, g) => sum + g.seconds, 0) /
        (scoredMinutes * MIN),
      sinceLast,
      kinds: {
        buys: buys.length,
        projects: projects.length,
        actions: actions.length,
      },
    };
  });
}

const minuteOf = (seconds: number): string => (seconds / MIN).toFixed(1);

/** One line per phase: seconds since the last decision at each minute's end. */
export function formatDecisionCurve(
  curve: readonly PhaseDecisions[]
): string[] {
  return curve.map((p) => {
    const cells = p.sinceLast
      .map((s) => String(Math.round(s)).padStart(4))
      .join("");
    return `${p.phase.padEnd(7)}${cells}`;
  });
}

/** One line per phase: the long gaps and where they fall. */
export function formatLongGaps(curve: readonly PhaseDecisions[]): string[] {
  return curve.map((p) => {
    const list = p.long.length
      ? p.long
          .map((g) => `${Math.round(g.seconds)}s at min ${minuteOf(g.from)}`)
          .join(", ")
      : "none";
    return `${p.phase.padEnd(7)}longest ${Math.round(p.longest)}s, p90 ${Math.round(
      p.p90
    )}s, ${Math.round(p.deadShare * 100)}% in gaps over ${LONG_GAP_SECONDS}s, ${p.perMinute.toFixed(2)} decisions/min (buys ${p.kinds.buys}, projects ${
      p.kinds.projects
    }, choices ${p.kinds.actions}); over ${LONG_GAP_SECONDS}s: ${list}`;
  });
}
