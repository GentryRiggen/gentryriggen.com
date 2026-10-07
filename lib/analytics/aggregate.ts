import type { PageviewDoc, Site } from "./types";
import { utcDay } from "./visitor";

const DAY_MS = 86_400_000;
const TOP_N = 8;

export interface Totals {
  views: number;
  visitors: number;
}
export interface DayPoint extends Totals {
  date: string;
}
export interface Count {
  key: string;
  views: number;
}
export interface Place extends Totals {
  tz: string;
}
export type BreakdownKey =
  "paths" | "referrers" | "devices" | "browsers" | "systems" | "screens";

export interface Summary {
  totals: Totals;
  previous: Totals;
  series: DayPoint[];
  breakdowns: Record<BreakdownKey, Count[]>;
  places: Place[];
}

export interface SummarizeOptions {
  site: Site | "all";
  days: number;
  now: Date;
}

/**
 * Visitors are daily-unique: the visitor id rotates every UTC day, so one
 * person on two days counts twice. Keys are therefore (day, id) pairs.
 */
function totalsOf(docs: PageviewDoc[]): Totals {
  const visitors = new Set(docs.map((d) => `${utcDay(d.ts)}|${d.vid}`));
  return { views: docs.length, visitors: visitors.size };
}

function top(docs: PageviewDoc[], pick: (d: PageviewDoc) => string): Count[] {
  const counts = new Map<string, number>();
  for (const d of docs) {
    const key = pick(d);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts]
    .map(([key, views]) => ({ key, views }))
    .sort((a, b) => b.views - a.views || a.key.localeCompare(b.key))
    .slice(0, TOP_N);
}

/** Aggregates raw docs over `days` UTC days ending today, plus the prior window. */
export function summarize(
  docs: PageviewDoc[],
  { site, days, now }: SummarizeOptions
): Summary {
  const end = now.getTime() - (now.getTime() % DAY_MS) + DAY_MS;
  const start = end - days * DAY_MS;
  const previousStart = start - days * DAY_MS;

  const scoped = site === "all" ? docs : docs.filter((d) => d.site === site);
  const inRange = (d: PageviewDoc, from: number, to: number) => {
    const t = d.ts.getTime();
    return t >= from && t < to;
  };
  const current = scoped.filter((d) => inRange(d, start, end));
  const previous = scoped.filter((d) => inRange(d, previousStart, start));

  const byDay = new Map<string, PageviewDoc[]>();
  for (const d of current) {
    const key = utcDay(d.ts);
    const list = byDay.get(key);
    if (list) list.push(d);
    else byDay.set(key, [d]);
  }
  const series = Array.from({ length: days }, (_, i) => {
    const date = utcDay(new Date(start + i * DAY_MS));
    return { date, ...totalsOf(byDay.get(date) ?? []) };
  });

  const byTz = new Map<string, PageviewDoc[]>();
  for (const d of current) {
    const list = byTz.get(d.tz);
    if (list) list.push(d);
    else byTz.set(d.tz, [d]);
  }
  const places = [...byTz]
    .map(([tz, list]) => ({ tz, ...totalsOf(list) }))
    .sort((a, b) => b.views - a.views || a.tz.localeCompare(b.tz));

  return {
    totals: totalsOf(current),
    previous: totalsOf(previous),
    series,
    breakdowns: {
      paths: top(current, (d) => d.path),
      referrers: top(current, (d) => d.ref || "(direct)"),
      devices: top(current, (d) => d.device),
      browsers: top(current, (d) => d.browser),
      systems: top(current, (d) => d.os),
      screens: top(current, (d) => d.screen),
    },
    places,
  };
}

/** Percentage change vs the previous period, or null when there is no baseline. */
export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}
