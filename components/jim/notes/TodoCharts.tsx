"use client";

import { useState } from "react";
import { fmtDay, fmtShort } from "@/lib/jim/todos";
import type { DayCount, TodoStats } from "@/lib/jim/todosPage";

/**
 * The Todos page's "at a glance": four tiles, two 14-day column charts and
 * the Work / Personal split. Every tile and column is a button that applies
 * its filter. Plain HTML marks on the Ayu tokens: columns at most 24px wide
 * with a 4px rounded data end and a square foot, 2px apart; zero days keep
 * a hairline stub; text stays in text tokens, never a series color.
 *
 * Colors (checked with the dataviz validator against the panel #242936):
 * Work blue and Personal orange pass both CVD (ΔE 19.8) and normal vision
 * (24.0); Ayu's pastels sit above the lightness band, so every part also
 * carries its name in text. Late is the status red, always labeled "Late".
 * The only inline styles are data-driven geometry (a bar's height, a part's
 * share), as the site's gauges do.
 */

function todos(n: number): string {
  return `${n} todo${n === 1 ? "" : "s"}`;
}

interface TileProps {
  label: string;
  value: number;
  /** The figure turns red (Overdue above zero). */
  alarm?: boolean;
  selected: boolean;
  onPick: () => void;
}

function Tile({ label, value, alarm = false, selected, onPick }: TileProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onPick}
      className={`jim-card relative min-h-11 min-w-0 overflow-hidden px-4 py-2.5 text-left @2xl:py-3 transition-colors duration-150 hover:border-ayu-accent/40 ${
        selected ? "border-ayu-accent/50! ring-1 ring-ayu-accent/30" : ""
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute -top-10 -right-10 size-24 rounded-full blur-2xl ${
          alarm ? "bg-ayu-red/15" : "bg-ayu-accent/10"
        }`}
      />
      <span className="block truncate text-sm text-ayu-subtle">{label}</span>
      <span
        className={`block text-2xl leading-tight font-semibold tracking-tight @2xl:mt-0.5 @2xl:text-[1.75rem] ${
          alarm ? "text-ayu-red" : "jim-figure"
        }`}
      >
        {value}
      </span>
    </button>
  );
}

interface TilesProps {
  stats: TodoStats;
  /** Which tile's filter is on, if any. */
  selected: "open" | "overdue" | "week" | "done" | null;
  onPick: (tile: "open" | "overdue" | "week" | "done") => void;
}

export function TodoTiles({ stats, selected, onPick }: TilesProps) {
  return (
    <div className="grid grid-cols-2 gap-2.5 @2xl:grid-cols-4 @2xl:gap-3">
      <Tile
        label="Open"
        value={stats.open}
        selected={selected === "open"}
        onPick={() => onPick("open")}
      />
      <Tile
        label="Overdue"
        value={stats.overdue}
        alarm={stats.overdue > 0}
        selected={selected === "overdue"}
        onPick={() => onPick("overdue")}
      />
      <Tile
        label="Due this week"
        value={stats.week}
        selected={selected === "week"}
        onPick={() => onPick("week")}
      />
      <Tile
        label="Done in 14 days"
        value={stats.done}
        selected={selected === "done"}
        onPick={() => onPick("done")}
      />
    </div>
  );
}

export interface Column {
  key: string;
  /** Under the axis, when it shows (first, last and marked columns). */
  tick: string;
  n: number;
  /** Read out and shown when hovered or focused ("Thu, Nov 5: 2 due"). */
  label: string;
  tone: "accent" | "green" | "red";
  /** Its axis label always shows (Late, today). */
  marked?: boolean;
}

const FILLS: Record<Column["tone"], string> = {
  accent: "bg-ayu-accent",
  green: "bg-ayu-green",
  red: "bg-ayu-red",
};

interface ColumnChartProps {
  title: string;
  /** What the chart says, for a screen reader, in one sentence. */
  summary: string;
  columns: Column[];
  /** The column whose filter is on: the others dim. */
  selected: string | null;
  onPick: (key: string) => void;
}

/** The tallest column's share of its slot: room above for its number. */
const PLOT = 80;

/** 14ish columns that are also buttons: tap one to filter to it. */
export function ColumnChart({
  title,
  summary,
  columns,
  selected,
  onPick,
}: ColumnChartProps) {
  const [hover, setHover] = useState<string | null>(null);
  const peak = Math.max(0, ...columns.map((c) => c.n));
  const top = Math.max(1, peak);
  const shown = columns.find((c) => c.key === hover);
  const ticks = new Set([
    columns[0]?.key,
    columns[columns.length - 1]?.key,
    ...columns.filter((c) => c.marked).map((c) => c.key),
  ]);
  return (
    <figure className="jim-card min-w-0 space-y-2 px-4 pt-3 pb-2.5">
      <figcaption className="flex min-h-5 items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-ayu-text">{title}</span>
        <span
          aria-hidden="true"
          className="min-w-0 truncate text-xs text-ayu-subtle tabular-nums"
        >
          {shown ? shown.label : peak > 0 ? `Most ${peak} a day` : "None yet"}
        </span>
      </figcaption>
      <div
        role="group"
        aria-label={`${title}. ${summary}`}
        className="relative flex items-stretch gap-0.5"
        onMouseLeave={() => setHover(null)}
      >
        {/* The baseline, a hairline under every column. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-white/10"
        />
        {columns.map((c) => {
          const h = (c.n / top) * PLOT;
          const dim = selected !== null && selected !== c.key;
          return (
            <button
              key={c.key}
              type="button"
              aria-label={c.label}
              aria-pressed={selected === c.key}
              title={c.label}
              onClick={() => onPick(c.key)}
              onMouseEnter={() => setHover(c.key)}
              onFocus={() => setHover(c.key)}
              onBlur={() => setHover(null)}
              className="group relative flex h-[4.5rem] min-h-11 @2xl:h-[5.5rem] min-w-0 flex-1 flex-col items-center justify-end rounded-md hover:bg-white/[0.04] focus-visible:bg-white/[0.06]"
            >
              {c.n > 0 && c.n === peak && (
                <span
                  aria-hidden="true"
                  className="mb-0.5 text-[0.6875rem] leading-none text-ayu-subtle tabular-nums"
                >
                  {c.n}
                </span>
              )}
              {c.n > 0 ? (
                <span
                  aria-hidden="true"
                  style={{ height: `${h}%` }}
                  className={`block min-h-1 w-full max-w-6 rounded-t-[4px] transition-opacity duration-150 motion-reduce:transition-none ${FILLS[c.tone]} ${
                    dim ? "opacity-35" : "group-hover:brightness-110"
                  }`}
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="block h-0.5 w-full max-w-6 rounded-t-sm bg-white/15"
                />
              )}
            </button>
          );
        })}
      </div>
      <div
        aria-hidden="true"
        className="flex gap-0.5 text-[0.6875rem] text-ayu-subtle tabular-nums"
      >
        {columns.map((c) => (
          <span
            key={c.key}
            className={`min-w-0 flex-1 text-center whitespace-nowrap ${
              c.tone === "red" ? "text-ayu-red" : ""
            }`}
          >
            {/* Wider labels hang off their column; only a few show. */}
            <span className="relative inline-block w-0 overflow-visible">
              <span
                className={`absolute top-0 ${
                  c.key === columns[0]?.key
                    ? "left-[-0.5rem]"
                    : c.key === columns[columns.length - 1]?.key
                      ? "right-[-0.5rem]"
                      : "left-1/2 -translate-x-1/2"
                }`}
              >
                {ticks.has(c.key) ? c.tick : ""}
              </span>
            </span>
          </span>
        ))}
      </div>
      <div aria-hidden="true" className="h-3" />
    </figure>
  );
}

/** Done per day: the last 14 days, today at the right. */
export function doneColumns(days: DayCount[], today: string): Column[] {
  return days.map((d) => ({
    key: d.day,
    tick: d.day === today ? "Today" : fmtShort(d.day),
    n: d.n,
    label: `${d.day === today ? "Today" : fmtDay(d.day)}: ${d.n} done`,
    tone: "green",
    marked: false,
  }));
}

/** Late, then the next 14 days of due dates. */
export function comingColumns(
  up: { late: number; days: DayCount[] },
  today: string
): Column[] {
  return [
    {
      key: "overdue",
      tick: "Late",
      n: up.late,
      label: `Late: ${todos(up.late)}`,
      tone: "red",
      marked: true,
    },
    ...up.days.map((d): Column => ({
      key: d.day,
      tick: d.day === today ? "Today" : fmtShort(d.day),
      n: d.n,
      label: `${d.day === today ? "Today" : fmtDay(d.day)}: ${d.n} due`,
      tone: "accent",
    })),
  ];
}

/** "4 done in 14 days, most on Thu, Oct 29 (2)." */
export function doneSummary(days: DayCount[]): string {
  const total = days.reduce((s, d) => s + d.n, 0);
  if (!total) return "Nothing done in the last 14 days.";
  const best = days.reduce((a, b) => (b.n > a.n ? b : a));
  return `${total} done in 14 days, most on ${fmtDay(best.day)} (${best.n}).`;
}

/** "1 late; 3 due in the next 14 days." */
export function comingSummary(up: { late: number; days: DayCount[] }): string {
  const total = up.days.reduce((s, d) => s + d.n, 0);
  return `${up.late} late; ${todos(total)} due in the next 14 days.`;
}

interface AreaSplitProps {
  work: number;
  personal: number;
  unsorted: number;
  /** The area filter on, if any: its block stays lit. */
  area: "all" | "work" | "personal";
  onPick: (area: "work" | "personal") => void;
}

/** A part narrower than this share prints no number (its name says it). */
const LABEL_MIN = 0.12;

/**
 * Work vs Personal as one tall segmented bar (28px), each part a button with
 * its count inside in near-black; a legend under it names the parts.
 */
export function AreaSplit({
  work,
  personal,
  unsorted,
  area,
  onPick,
}: AreaSplitProps) {
  const total = work + personal + unsorted;
  const parts = [
    { key: "work" as const, name: "Work", n: work, fill: "bg-ayu-blue" },
    {
      key: "personal" as const,
      name: "Personal",
      n: personal,
      fill: "bg-ayu-orange",
    },
    { key: "unsorted" as const, name: "Untagged", n: unsorted, fill: "" },
  ].filter((p) => p.n > 0);
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const summary = parts
    .map((p) => `${p.name} ${p.n} (${pct(p.n)}%)`)
    .join(", ");
  return (
    <figure className="jim-card min-w-0 space-y-3 px-4 pt-3 pb-3.5">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium whitespace-nowrap text-ayu-text">
          Work vs personal
        </span>
        <span className="text-xs whitespace-nowrap text-ayu-subtle tabular-nums">
          {total} open
        </span>
      </figcaption>
      {total === 0 ? (
        <p className="text-sm text-ayu-subtle">No open todos.</p>
      ) : (
        <div
          role="group"
          aria-label={`Open todos by area: ${summary}.`}
          className="flex min-h-11 items-center gap-0.5"
        >
          {parts.map((p) => {
            const share = p.n / total;
            const block = (
              <span
                aria-hidden="true"
                className={`flex h-7 w-full items-center rounded-[4px] px-2 text-xs font-semibold text-ayu-bg tabular-nums ${
                  p.fill || "bg-ayu-muted"
                } ${area !== "all" && area !== p.key ? "opacity-35" : ""}`}
              >
                {share >= LABEL_MIN ? p.n : ""}
              </span>
            );
            const style = { flexGrow: p.n, flexBasis: 0 };
            return p.key === "unsorted" ? (
              <span
                key={p.key}
                style={style}
                title={`Untagged: ${todos(p.n)}`}
                className="flex min-h-11 min-w-1.5 items-center"
              >
                {block}
              </span>
            ) : (
              <button
                key={p.key}
                type="button"
                style={style}
                aria-label={`${p.name}: ${todos(p.n)}`}
                aria-pressed={area === p.key}
                title={`${p.name}: ${todos(p.n)}`}
                onClick={() => onPick(p.key)}
                className="flex min-h-11 min-w-1.5 items-center rounded-md hover:brightness-110"
              >
                {block}
              </button>
            );
          })}
        </div>
      )}
      {total > 0 && (
        <ul aria-hidden="true" className="flex flex-wrap gap-x-4 gap-y-1">
          {parts.map((p) => (
            <li key={p.key} className="flex items-center gap-1.5 text-sm">
              <span
                className={`size-2.5 shrink-0 rounded-sm ${p.fill || "bg-ayu-muted"}`}
              />
              <span className="text-ayu-text">{p.name}</span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}
