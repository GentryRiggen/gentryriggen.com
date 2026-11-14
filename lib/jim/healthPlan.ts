import type { DosePlan, HealthData, Injection } from "@/lib/jim/view";
import { addDays } from "@/lib/jim/todos";

/**
 * What the Health page works out from the injection log and the dosing
 * schedule (health/trt.md in Jim's repo). Dates are plain YYYY-MM-DD
 * strings, so a daylight-saving change can't shift a day.
 */

export type Side = "left" | "right";

/** "Left glute" -> "left"; anything else (or blank) -> null. */
export function sideOf(site: string | undefined): Side | null {
  const s = String(site ?? "").toLowerCase();
  if (/\bleft\b/.test(s)) return "left";
  if (/\bright\b/.test(s)) return "right";
  return null;
}

export function otherSide(side: Side | null): Side | null {
  return side === "left" ? "right" : side === "right" ? "left" : null;
}

export function sideLabel(side: Side): string {
  return side === "left" ? "Left glute" : "Right glute";
}

/** The log newest first (same-day shots by the later one first). */
export function shotsNewestFirst(injections: Injection[]): Injection[] {
  return injections
    .filter((i) => typeof i?.date === "string")
    .map((i, n) => ({ i, n }))
    .sort((a, b) => b.i.date.localeCompare(a.i.date) || a.n - b.n)
    .map((x) => x.i);
}

/** Monday = 0, from the date itself (not the device clock). */
export function weekday(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export function mondayOf(iso: string): string {
  return addDays(iso, -weekday(iso));
}

/** The plan in force on `today`, and the next one that takes over. */
export function plans(
  schedule: DosePlan[] | undefined,
  today: string
): { current: DosePlan | null; upcoming: DosePlan | null } {
  const rows = [...(schedule ?? [])].sort((a, b) =>
    a.from.localeCompare(b.from)
  );
  let current: DosePlan | null = null;
  let upcoming: DosePlan | null = null;
  for (const p of rows) {
    if (p.from <= today) current = p;
    else if (!upcoming) upcoming = p;
  }
  return { current, upcoming };
}

/** The plan that governs `date` (the latest one starting on or before it). */
function planOn(rows: DosePlan[], date: string): DosePlan | null {
  let found: DosePlan | null = null;
  for (const p of rows) if (p.from <= date) found = p;
  return found;
}

/** True when the schedule has a shot due on `date`. */
export function dueOn(schedule: DosePlan[] | undefined, date: string): boolean {
  const rows = [...(schedule ?? [])].sort((a, b) =>
    a.from.localeCompare(b.from)
  );
  const p = planOn(rows, date);
  return !!p && p.days.includes(weekday(date));
}

export interface NextShot {
  date: string;
  /** "overdue" = a scheduled day passed with no shot logged since. */
  state: "overdue" | "today" | "upcoming";
  mg: number;
  ml: number | null;
}

/**
 * The first scheduled day after the last shot. A plan with no fixed days
 * gives nothing (no date can be worked out). With no shot logged, the
 * first scheduled day from today.
 */
export function nextShot(
  schedule: DosePlan[] | undefined,
  lastDate: string | null,
  today: string
): NextShot | null {
  const rows = [...(schedule ?? [])].sort((a, b) =>
    a.from.localeCompare(b.from)
  );
  const start = lastDate ? addDays(lastDate, 1) : today;
  for (let i = 0; i < 60; i++) {
    const date = addDays(start, i);
    const p = planOn(rows, date);
    if (!p) continue;
    if (!p.days.length) return null;
    if (p.days.includes(weekday(date))) {
      return {
        date,
        state: date < today ? "overdue" : date === today ? "today" : "upcoming",
        mg: p.mg,
        ml: p.ml,
      };
    }
  }
  return null;
}

export interface WeekDay {
  date: string;
  due: boolean;
  today: boolean;
  /** Shots logged that day, oldest first. */
  shots: Injection[];
}

/** `weeks` Monday-to-Sunday rows starting with the week of `today`. */
export function weekGrid(
  health: Pick<HealthData, "injections" | "schedule">,
  today: string,
  weeks = 2
): WeekDay[][] {
  const start = mondayOf(today);
  const rows: WeekDay[][] = [];
  for (let w = 0; w < weeks; w++) {
    const row: WeekDay[] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(start, w * 7 + d);
      row.push({
        date,
        due: dueOn(health.schedule, date),
        today: date === today,
        shots: health.injections.filter((i) => i.date === date).reverse(),
      });
    }
    rows.push(row);
  }
  return rows;
}

export interface WeekTotal {
  /** The Monday that starts the week. */
  monday: string;
  mg: number;
  shots: number;
  /** The week isn't over yet. */
  partial: boolean;
}

/** Milligrams per Monday-to-Sunday week, oldest first, ending with this one. */
export function weeklyTotals(
  injections: Injection[],
  today: string,
  weeks = 8
): WeekTotal[] {
  const thisMonday = mondayOf(today);
  const out: WeekTotal[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const monday = addDays(thisMonday, -7 * w);
    const end = addDays(monday, 6);
    const inWeek = injections.filter(
      (i) => i.date >= monday && i.date <= end && typeof i.mg === "number"
    );
    out.push({
      monday,
      mg: inWeek.reduce((sum, i) => sum + (i.mg ?? 0), 0),
      shots: inWeek.length,
      partial: end >= today,
    });
  }
  return out;
}

/** "2 days ago", "today", "yesterday", "in 2 days". */
export function agoText(n: number): string {
  if (n === 0) return "today";
  if (n === 1) return "yesterday";
  if (n === -1) return "tomorrow";
  return n > 0 ? `${n} days ago` : `in ${-n} days`;
}

/** The shot time as Gentry wrote it, without the leading "~"; blank when unknown. */
export function shotTime(time: string | undefined): string {
  const t = String(time ?? "")
    .replace(/^~\s*/, "")
    .trim();
  return t;
}

/**
 * The few markers worth a chart: testosterone (total and free), estradiol,
 * hematocrit, hemoglobin and ferritin. Everything else folds away.
 */
const KEY_MARKERS = [
  /^total testosterone/i,
  /^free testosterone/i,
  /^estradiol/i,
  /^hematocrit/i,
  /^hemoglobin(?! a1c)/i,
  /^ferritin/i,
];

/** Position in the key list (0-5), or -1 when the marker isn't one of them. */
export function keyMarkerRank(marker: string): number {
  return KEY_MARKERS.findIndex((re) => re.test(marker));
}
