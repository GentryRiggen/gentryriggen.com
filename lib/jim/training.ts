import { e1rm, movementBests, type Movement } from "@/lib/jim/notesData";
import { movementSlug } from "@/lib/jim/routes";
import { addDays } from "@/lib/jim/todos";
import type { Lift, TrainingData, Workout } from "@/lib/jim/view";

/**
 * Training math for the movement and day pages, ported from the Mac
 * viewer's training page: PRs, the days trained, the est. 1RM trend and a
 * year of calendar. Pure functions over the view's lifts and workouts.
 */

const FULL_DAY = /^\d{4}-\d{2}-\d{2}$/;

export const isFullDay = (d: string): boolean => FULL_DAY.test(d);

/** A lift that counts toward PRs and rep maxes. */
function isStrength(l: Lift): boolean {
  return (
    l.kind === "strength" &&
    l.weight != null &&
    l.reps != null &&
    l.reps > 0 &&
    l.unit !== "in"
  );
}

/**
 * Every set that was a PR when it was lifted: nothing on an earlier day (or
 * heavier the same day) was as heavy for at least as many reps.
 */
export function prLifts(lifts: Lift[]): Set<Lift> {
  const by = new Map<string, Lift[]>();
  for (const l of lifts) {
    if (!l?.movement || typeof l.date !== "string" || !isStrength(l)) continue;
    by.set(l.movement, [...(by.get(l.movement) ?? []), l]);
  }
  const prs = new Set<Lift>();
  for (const rows of by.values()) {
    // Same day: heaviest last, so it is the one that counts.
    rows.sort(
      (a, b) =>
        a.date.localeCompare(b.date) || (a.weight ?? 0) - (b.weight ?? 0)
    );
    rows.forEach((l, i) => {
      const beaten = rows.some(
        (o, j) =>
          j !== i &&
          (o.date < l.date || (o.date === l.date && j > i)) &&
          (o.reps as number) >= (l.reps as number) &&
          (o.weight as number) >= (l.weight as number)
      );
      if (!beaten) prs.add(l);
    });
  }
  return prs;
}

export interface TrainingDay {
  workouts: Workout[];
  lifts: Lift[];
}

/** Every logged day (full dates only) with its workouts and lifts. */
export function trainingDays(training: TrainingData): Map<string, TrainingDay> {
  const days = new Map<string, TrainingDay>();
  const at = (d: string) => {
    let day = days.get(d);
    if (!day) {
      day = { workouts: [], lifts: [] };
      days.set(d, day);
    }
    return day;
  };
  for (const w of training.workouts) {
    if (typeof w?.date === "string" && isFullDay(w.date))
      at(w.date).workouts.push(w);
  }
  for (const l of training.lifts) {
    if (typeof l?.date === "string" && isFullDay(l.date))
      at(l.date).lifts.push(l);
  }
  return days;
}

/** The days before and after `day` that have something logged. */
export function neighborDays(
  days: Map<string, TrainingDay>,
  day: string
): { prev: string | null; next: string | null } {
  let prev: string | null = null;
  let next: string | null = null;
  for (const d of days.keys()) {
    if (d < day && (prev === null || d > prev)) prev = d;
    if (d > day && (next === null || d < next)) next = d;
  }
  return { prev, next };
}

export interface MovementPage {
  movement: Movement;
  /** Every entry, newest first. */
  rows: Lift[];
  /** The best est. 1RM each day (full dates, oldest first): the past year
   * when it has two or more, else everything. */
  trend: { date: string; v: number }[];
  /** The trend leaves older entries out. */
  trendTrimmed: boolean;
}

/** The movement whose name slugs to `slug`, with its page's numbers. */
export function movementPage(
  lifts: Lift[],
  slug: string,
  today: string
): MovementPage | null {
  const movement = movementBests(lifts).find(
    (m) => movementSlug(m.name) === slug
  );
  if (!movement) return null;
  const rows = lifts
    .filter((l) => l?.movement === movement.name && typeof l.date === "string")
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || (b.weight ?? 0) - (a.weight ?? 0)
    );
  const best = new Map<string, number>();
  for (const l of rows) {
    if (!isFullDay(l.date) || !isStrength(l)) continue;
    const v = e1rm(l);
    if (v != null) best.set(l.date, Math.max(best.get(l.date) ?? 0, v));
  }
  const all = [...best]
    .map(([date, v]) => ({ date, v: Math.round(v) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const yearAgo = addDays(today, -365);
  const recent = all.filter((p) => p.date >= yearAgo);
  const trimmed = recent.length > 1 && recent.length < all.length;
  return {
    movement,
    rows,
    trend: trimmed ? recent : all,
    trendTrimmed: trimmed,
  };
}

/** 0 nothing, 1 light, 2 more, 3 most (a PR, say). */
export type HeatLevel = 0 | 1 | 2 | 3;

export interface HeatWeek {
  /** Seven days, Sunday first; null outside the range. */
  days: ({ date: string; level: HeatLevel } | null)[];
}

/**
 * The 52-ish weeks ending on `today`, Sunday-first columns like a
 * contribution calendar. Days before the first or after today are null.
 */
export function yearWeeks(
  today: string,
  level: (date: string) => HeatLevel
): HeatWeek[] {
  const from = addDays(today, -364);
  const dow = new Date(`${from}T12:00:00Z`).getUTCDay();
  const weeks: HeatWeek[] = [];
  for (
    let start = addDays(from, -dow);
    start <= today;
    start = addDays(start, 7)
  ) {
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(start, i);
      return date < from || date > today ? null : { date, level: level(date) };
    });
    weeks.push({ days });
  }
  return weeks;
}
