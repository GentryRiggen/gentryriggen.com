import {
  addDays,
  daysBetween,
  fmtShort,
  monthName,
  stripMd,
} from "@/lib/jim/todos";
import { fmtWeight, type WeightUnit } from "@/lib/jim/weightUnit";
import type {
  Birth,
  CalendarEvent,
  GolfRound,
  HealthData,
  Lift,
  Person,
  ViewData,
} from "@/lib/jim/view";

/**
 * Pure helpers for the Notes pages, mirroring the Mac viewer's rules
 * (bin/view/home.js, health.js, training.js, golf.js, people.js, core.js).
 */

// ---------- calendar ----------

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** The device's local day for an ISO time. */
export function localDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function eventDay(e: CalendarEvent): string {
  return e.allDay ? e.start.slice(0, 10) : localDay(e.start);
}

/** "9am", "1:30pm" in the device's time zone. */
export function timeLabel(iso: string): string {
  return new Date(iso)
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    .replace(":00", "")
    .replace(" ", "")
    .toLowerCase();
}

export interface CalendarDay {
  day: string;
  events: CalendarEvent[];
}

/** Days from today through today + 7 that have events, all-day first. */
export function eventsByDay(
  events: CalendarEvent[],
  today: string
): CalendarDay[] {
  const last = addDays(today, 7);
  const by = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    if (typeof e?.start !== "string") continue;
    const day = eventDay(e);
    if (day < today || day > last) continue;
    by.set(day, [...(by.get(day) ?? []), e]);
  }
  return [...by.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, list]) => ({
      day,
      events: list.sort(
        (a, b) =>
          Number(Boolean(b.allDay)) - Number(Boolean(a.allDay)) ||
          a.start.localeCompare(b.start)
      ),
    }));
}

// ---------- health ----------

export interface LabValue {
  v: number;
  cmp: string;
  flag: string;
  raw: string;
}

export function parseLabVal(raw: string): LabValue | null {
  const s = String(raw ?? "")
    .replace(/\*\*/g, "")
    .trim();
  const m = s.match(/^([<>≤≥])?\s*([\d.]+)\s*([HL])?\b/);
  if (!m || Number.isNaN(Number(m[2]))) return null;
  return { v: Number(m[2]), cmp: m[1] || "", flag: m[3] || "", raw: s };
}

export function parseRange(r: string): {
  lo: number | null;
  hi: number | null;
} {
  const s = String(r ?? "")
    .replace(/\*\*/g, "")
    .trim();
  let m = s.match(/^([\d.]+)\s*[–-]\s*([\d.]+)/);
  if (m) return { lo: Number(m[1]), hi: Number(m[2]) };
  m = s.match(/^(≤|<=|<)\s*([\d.]+)/);
  if (m) return { lo: null, hi: Number(m[2]) };
  m = s.match(/^(≥|>=|>)\s*([\d.]+)/);
  if (m) return { lo: Number(m[2]), hi: null };
  return { lo: null, hi: null };
}

/** Set aside until a draw newer than hold.until lands. */
function held(health: HealthData, marker: string): boolean {
  const hold = health.hold;
  if (!hold || health.draws.some((d) => d.date > hold.until)) return false;
  return hold.markers.some((m) =>
    marker.toLowerCase().startsWith(String(m).toLowerCase())
  );
}

export interface LabPoint extends LabValue {
  date: string;
  lab: string;
}

export interface LabCard {
  marker: string;
  points: LabPoint[];
  latest: LabPoint;
  /** The latest lab's reference range, as written. */
  range: string;
  lo: number | null;
  hi: number | null;
}

/** One card per marker, flagged ones first, then the most recent. */
export function labCards(health: HealthData): LabCard[] {
  const by = new Map<string, { points: LabPoint[]; ranges: string[] }>();
  for (const row of health.labs) {
    if (!row?.marker || held(health, row.marker)) continue;
    const g = by.get(row.marker) ?? { points: [], ranges: [] };
    let any = false;
    for (const v of row.values ?? []) {
      const p = parseLabVal(v.raw);
      if (!p) continue;
      g.points.push({ ...p, date: v.date, lab: row.lab });
      any = true;
    }
    if (any) g.ranges.push(row.range);
    by.set(row.marker, g);
  }
  const cards: LabCard[] = [];
  for (const [marker, g] of by) {
    if (!g.points.length) continue;
    g.points.sort((a, b) => a.date.localeCompare(b.date));
    const range = g.ranges[g.ranges.length - 1] ?? "";
    cards.push({
      marker,
      points: g.points,
      latest: g.points[g.points.length - 1],
      range,
      ...parseRange(range),
    });
  }
  return cards.sort(
    (a, b) =>
      Number(Boolean(b.latest.flag)) - Number(Boolean(a.latest.flag)) ||
      b.latest.date.localeCompare(a.latest.date)
  );
}

// ---------- training ----------

/** Epley-style estimate the Mac viewer uses: weight × (1 + reps / 30), up to 10 reps. */
export function e1rm(l: Lift): number | null {
  return l.weight != null &&
    l.unit !== "in" &&
    !l.repUnit &&
    l.reps &&
    l.reps <= 10
    ? l.weight * (l.reps === 1 ? 1 : 1 + l.reps / 30)
    : null;
}

export function fmtNum(v: number): string {
  return (
    Math.abs(v) >= 100 ? Math.round(v) : Number(v.toFixed(1))
  ).toLocaleString("en-US");
}

/** "3×5 @ 225 lb", "12", "10 @ 24"". */
export function setText(l: Lift, unit: WeightUnit = "lb"): string {
  const amount =
    l.weight == null
      ? ""
      : l.unit === "in"
        ? ` @ ${fmtNum(l.weight)}"`
        : ` @ ${fmtWeight(l.weight, unit)}`;
  return `${l.sets > 1 ? `${l.sets}×` : ""}${l.reps ?? "?"}${l.repUnit ? ` ${l.repUnit}` : ""}${amount}`;
}

export interface Movement {
  name: string;
  last: Lift;
  entries: number;
  bodyweight: boolean;
  maxReps: number | null;
  heaviest: Lift | null;
  /** Rounded est. 1RM in lb, from strength sets of 10 reps or fewer. */
  est1rm: number | null;
  /** Heaviest weight lifted for at least each rep count. */
  repMax: { reps: number; weight: number; date: string }[];
}

export function movementBests(lifts: Lift[]): Movement[] {
  const by = new Map<string, Lift[]>();
  for (const l of lifts) {
    if (!l?.movement || typeof l.date !== "string") continue;
    by.set(l.movement, [...(by.get(l.movement) ?? []), l]);
  }
  const out: Movement[] = [];
  for (const [name, rows] of by) {
    rows.sort(
      (a, b) =>
        a.date.localeCompare(b.date) || (a.weight ?? 0) - (b.weight ?? 0)
    );
    const strength = rows.filter(
      (l) => l.kind === "strength" && l.weight != null && l.reps
    );
    const repCounts = [...new Set(strength.map((l) => l.reps as number))].sort(
      (a, b) => a - b
    );
    const repMax = repCounts.map((r) => {
      const best = strength
        .filter((l) => (l.reps as number) >= r)
        .sort(
          (a, b) =>
            (b.weight as number) - (a.weight as number) ||
            a.date.localeCompare(b.date)
        )[0];
      return { reps: r, weight: best.weight as number, date: best.date };
    });
    const ests = strength
      .map((l) => e1rm(l))
      .filter((v): v is number => v != null);
    const heaviest =
      rows
        .filter((l) => l.weight != null)
        .sort((a, b) => (b.weight as number) - (a.weight as number))[0] ?? null;
    const bodyweight = rows.every((l) => l.weight == null);
    out.push({
      name,
      last: rows[rows.length - 1],
      entries: rows.length,
      bodyweight,
      maxReps: bodyweight ? Math.max(...rows.map((l) => l.reps || 0)) : null,
      heaviest,
      est1rm: ests.length ? Math.round(Math.max(...ests)) : null,
      repMax,
    });
  }
  return out.sort(
    (a, b) =>
      b.last.date.localeCompare(a.last.date) || a.name.localeCompare(b.name)
  );
}

/** "Oct 2 2026", or "Oct 2026" for a lift whose day wasn't recorded. */
export function fmtWhen(d: string): string {
  return d.length === 7
    ? `${monthName(Number(d.slice(5, 7)))} ${d.slice(0, 4)}`
    : `${fmtShort(d)} ${d.slice(0, 4)}`;
}

// ---------- golf ----------

/** An 18-hole round counts as two nines. */
export function perNine(r: GolfRound, v: number | null): number | null {
  return v == null || !r.holes ? null : (v * 9) / r.holes;
}

export interface GolfSummary {
  /** Every round, newest first. */
  rounds: GolfRound[];
  counted: number;
  avgPerNine: number | null;
  best: GolfRound | null;
}

export function golfSummary(golf: GolfRound[]): GolfSummary {
  const rounds = golf
    .filter((r) => typeof r?.date === "string")
    .sort((a, b) => b.date.localeCompare(a.date));
  const counted = rounds.filter((r) => r.counts && r.score != null);
  const nines = counted.map((r) => perNine(r, r.score) as number);
  const best = counted.reduce<GolfRound | null>(
    (b, r) =>
      !b || (perNine(r, r.score) as number) < (perNine(b, b.score) as number)
        ? r
        : b,
    null
  );
  return {
    rounds,
    counted: counted.length,
    avgPerNine: nines.length
      ? Math.round((nines.reduce((s, v) => s + v, 0) / nines.length) * 10) / 10
      : null,
    best,
  };
}

// ---------- people ----------

export type PersonGroup = "Family" | "Work" | "Friends" | "Others";
export const PERSON_GROUPS: PersonGroup[] = [
  "Family",
  "Friends",
  "Work",
  "Others",
];

const SERVER_GROUPS: Record<string, PersonGroup> = {
  family: "Family",
  friends: "Friends",
  work: "Work",
  other: "Others",
};

/** The server's group when it sends one, else the Mac viewer's tag rules. */
export function personGroup(p: Person): PersonGroup {
  const fromServer =
    typeof p.group === "string" ? SERVER_GROUPS[p.group] : undefined;
  if (fromServer) return fromServer;
  const tags = (p.tags ?? []).map((t) => String(t).toLowerCase());
  const about = p.about ?? "";
  if (
    tags.includes("family") ||
    /\b(sister|brother|mom|dad|mother|father|son|nephew|niece|spouse|in-law|husband|wife)\b/i.test(
      about
    )
  )
    return "Family";
  if (tags.some((t) => ["work", "coworker", "direct-report"].includes(t)))
    return "Work";
  if (
    tags.some((t) => ["friend", "friends"].includes(t)) ||
    /\bfriend\b/i.test(about)
  )
    return "Friends";
  return "Others";
}

/** The next date (on or after today) a yearly month and day falls on. */
export function nextYearly(m: number, d: number, today: string): string {
  const y = Number(today.slice(0, 4));
  const iso = `${y}-${pad(m)}-${pad(d)}`;
  return iso >= today ? iso : `${y + 1}-${pad(m)}-${pad(d)}`;
}

export function ageOn(b: Birth | null, iso: string): number | null {
  if (!b || !b.y) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return y - b.y - (m < b.m || (m === b.m && d < (b.d || 1)) ? 1 : 0);
}

const SIGNS: [string, number, number][] = [
  ["Capricorn", 1, 19],
  ["Aquarius", 2, 18],
  ["Pisces", 3, 20],
  ["Aries", 4, 19],
  ["Taurus", 5, 20],
  ["Gemini", 6, 20],
  ["Cancer", 7, 22],
  ["Leo", 8, 22],
  ["Virgo", 9, 22],
  ["Libra", 10, 22],
  ["Scorpio", 11, 21],
  ["Sagittarius", 12, 21],
];

export function sunSign(m: number, d: number | null): string | null {
  if (!m || !d || m < 1 || m > 12) return null;
  const [name, , last] = SIGNS[m - 1];
  return d <= last ? name : SIGNS[m % 12][0];
}

/**
 * Chinese zodiac from the birth year. A birthday Jan 21 to Feb 20 could fall
 * either side of Lunar New Year, so it gives null rather than guess.
 */
export function chineseZodiac(b: Birth | null): string | null {
  if (!b || !b.y || !b.m) return null;
  const ambiguous =
    (b.m === 1 && (!b.d || b.d >= 21)) || (b.m === 2 && (!b.d || b.d <= 20));
  if (ambiguous) return null;
  const y = b.m === 1 ? b.y - 1 : b.y;
  const animals = [
    "Rat",
    "Ox",
    "Tiger",
    "Rabbit",
    "Dragon",
    "Snake",
    "Horse",
    "Goat",
    "Monkey",
    "Rooster",
    "Dog",
    "Pig",
  ];
  const elements = [
    "Metal",
    "Metal",
    "Water",
    "Water",
    "Wood",
    "Wood",
    "Fire",
    "Fire",
    "Earth",
    "Earth",
  ];
  return `${elements[y % 10]} ${animals[(((y - 4) % 12) + 12) % 12]}`;
}

function plural(n: number, w: string): string {
  return `${n} ${w}${n === 1 ? "" : "s"}`;
}

/** [label, value] pairs for the top of a profile ("" label: a full line). */
export function personFacts(p: Person, today: string): [string, string][] {
  const b = p.birth;
  const facts: [string, string][] = [];
  if (p.died) facts.push(["", stripMd(p.died)]);
  if (b && b.m) {
    const day = `${monthName(b.m)}${b.d ? ` ${b.d}` : ""}`;
    if (!p.died) {
      const n = b.d ? daysBetween(today, nextYearly(b.m, b.d, today)) : null;
      const age = ageOn(b, today);
      facts.push([
        "Birthday",
        `${day}${b.y ? `, ${b.y}` : ""}${b.unsure ? " (unconfirmed)" : ""}`,
      ]);
      if (age != null) facts.push(["Age", `${b.unsure ? "~" : ""}${age}`]);
      if (n != null)
        facts.push(["Next", n === 0 ? "today!" : `in ${plural(n, "day")}`]);
    } else {
      facts.push(["Born", `${day}${b.y ? `, ${b.y}` : ""}`]);
    }
    const sun = sunSign(b.m, b.d);
    const cz = p.zodiac || chineseZodiac(b);
    if (sun || cz) facts.push(["Signs", [sun, cz].filter(Boolean).join(" · ")]);
  }
  return facts;
}

// ---------- today ----------

export interface TodaySummary {
  /** The next (or current) timed event today, from today's snapshot. */
  meeting: { time: string; subject: string } | null;
  /** Days since the latest injection, or null with none logged. */
  injectionDays: number | null;
  /** Days trained this week (Mon–Sun), or null with no training at all. */
  workouts: number | null;
}

const FULL_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The Today card: what's next, and two numbers worth a glance. */
export function todaySummary(
  data: Pick<ViewData, "today" | "calendar" | "health" | "training">,
  now: Date
): TodaySummary {
  const { today, calendar } = data;

  let meeting: TodaySummary["meeting"] = null;
  if (
    calendar?.fetchedAt &&
    !Number.isNaN(Date.parse(calendar.fetchedAt)) &&
    localDay(calendar.fetchedAt) === today
  ) {
    const next = calendar.events
      .filter(
        (e) =>
          typeof e?.start === "string" &&
          !e.allDay &&
          localDay(e.start) === today &&
          Date.parse(e.end || e.start) > now.getTime()
      )
      .sort((a, b) => a.start.localeCompare(b.start))[0];
    if (next) meeting = { time: timeLabel(next.start), subject: next.subject };
  }

  const shots = data.health.injections
    .map((i) => i?.date)
    .filter((d): d is string => typeof d === "string" && FULL_DATE.test(d))
    .filter((d) => d <= today)
    .sort();
  const last = shots[shots.length - 1];
  const injectionDays = last ? daysBetween(last, today) : null;

  const { workouts: logged, lifts } = data.training;
  let workouts: number | null = null;
  if (logged.length || lifts.length) {
    const dow = new Date(`${today}T12:00:00Z`).getUTCDay();
    const monday = addDays(today, -((dow + 6) % 7));
    const sunday = addDays(monday, 6);
    const days = new Set(
      [...logged, ...lifts]
        .map((x) => x?.date)
        .filter(
          (d): d is string =>
            typeof d === "string" &&
            FULL_DATE.test(d) &&
            d >= monday &&
            d <= sunday
        )
    );
    workouts = days.size;
  }

  return { meeting, injectionDays, workouts };
}
