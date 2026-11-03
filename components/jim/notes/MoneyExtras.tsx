"use client";

import { Fragment, useState } from "react";
import { usd } from "@/components/jim/notes/MoneyCharts";
import {
  Empty,
  FilterChip,
  Rows,
  Section,
} from "@/components/jim/notes/NotesUi";
import type { MoneyAmazon, MoneyGrid } from "@/lib/jim/money";
import { fmtShort, monthName } from "@/lib/jim/todos";

/**
 * Money's newer sections: every category by month, and Amazon item by
 * item. Both come from the in-memory summary; nothing here is stored.
 */

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** "2026-01" → "Jan 26" on the first column and each January, else "Feb". */
function gridMonth(ym: string, i: number): string {
  const label = monthName(Number(ym.slice(5, 7)));
  return i === 0 || ym.endsWith("-01") ? `${label} ${ym.slice(2, 4)}` : label;
}

/** Whole dollars, short: $1.2k past a thousand. */
function short(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1000) {
    const k = Math.round(abs / 100) / 10;
    return `${n < 0 ? "−" : ""}$${k}k`;
  }
  return usd(n);
}

const CELL_TONES = {
  hi: "bg-ayu-red/15 text-ayu-red",
  lo: "bg-ayu-blue/12 text-ayu-blue",
  "": "text-ayu-text",
};

/** Every category, every month: scrolls sideways inside its card only. */
export function MoneyGridSection({ grid }: { grid: MoneyGrid }) {
  const { months, rows } = grid;
  return (
    <Section title="By category" aside={`${months.length} months`}>
      <div className="jim-card overflow-hidden">
        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-max min-w-full border-separate border-spacing-0 text-sm tabular-nums">
            <caption className="sr-only">
              Spending by category and month, with each category&apos;s typical
              month
            </caption>
            <thead>
              <tr className="text-xs text-ayu-subtle">
                <th
                  scope="col"
                  className="sticky left-0 z-10 bg-ayu-panel px-3 py-2 text-left font-medium"
                >
                  Category
                </th>
                {months.map((m, i) => (
                  <th
                    key={m}
                    scope="col"
                    className="px-2 py-2 text-right font-medium whitespace-nowrap"
                  >
                    {gridMonth(m, i)}
                  </th>
                ))}
                <th
                  scope="col"
                  className="px-3 py-2 text-right font-medium whitespace-nowrap"
                >
                  Typical
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <Fragment key={`${r.group}-${r.cat}`}>
                  {r.group && r.group !== rows[i - 1]?.group && (
                    <tr>
                      <th
                        scope="colgroup"
                        colSpan={months.length + 2}
                        className="sticky left-0 border-t border-white/[0.06] bg-ayu-panel px-3 pt-3 pb-1 text-left text-xs font-semibold tracking-wide text-ayu-subtle uppercase"
                      >
                        {r.group}
                      </th>
                    </tr>
                  )}
                  <tr>
                    <th
                      scope="row"
                      title={r.note || undefined}
                      className="sticky left-0 z-10 max-w-36 bg-ayu-panel px-3 py-1.5 text-left font-normal text-ayu-text"
                    >
                      <span className="block truncate">{r.cat}</span>
                      {r.fixed && (
                        <span className="text-xs text-ayu-subtle">fixed</span>
                      )}
                    </th>
                    {r.values.map((v, j) => (
                      <td
                        key={months[j]}
                        className={`px-2 py-1.5 text-right whitespace-nowrap ${CELL_TONES[r.flags[j] ?? ""]}`}
                      >
                        {v ? (
                          short(v)
                        ) : (
                          <span className="text-ayu-muted">·</span>
                        )}
                        {r.flags[j] === "hi" && (
                          <span className="sr-only"> (more than usual)</span>
                        )}
                        {r.flags[j] === "lo" && (
                          <span className="sr-only"> (less than usual)</span>
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-1.5 text-right whitespace-nowrap text-ayu-subtle">
                      {r.typical ? short(r.typical) : "·"}
                    </td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <p className="flex flex-wrap gap-x-4 gap-y-1 border-t border-white/[0.06] px-4 py-2.5 text-xs text-ayu-subtle">
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-sm bg-ayu-red/40"
            />
            More than usual
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-sm bg-ayu-blue/40"
            />
            Less than usual
          </span>
        </p>
      </div>
    </Section>
  );
}

/** Category colours, in the order the server sends them; the last is grey. */
const FILLS = [
  "fill-ayu-accent",
  "fill-ayu-blue",
  "fill-ayu-green",
  "fill-ayu-purple",
  "fill-ayu-cyan",
  "fill-ayu-orange",
  "fill-ayu-red",
];
const SWATCHES = [
  "bg-ayu-accent",
  "bg-ayu-blue",
  "bg-ayu-green",
  "bg-ayu-purple",
  "bg-ayu-cyan",
  "bg-ayu-orange",
  "bg-ayu-red",
];
const OTHER_FILL = "fill-ayu-muted";
const OTHER_SWATCH = "bg-ayu-muted";

function colorIndex(cats: string[], cat: string): number {
  const i = cats.indexOf(cat);
  return i < 0 || i >= FILLS.length || /^other$/i.test(cat) ? -1 : i;
}

const BAR_W = 10;
const BAR_GAP = 3;
const BAR_H = 100;

/** Spent per month, stacked by category (refunds that outweigh buys in a
 * category leave that slice out; the month's total still counts them). */
function AmazonBars({ amazon, focus }: { amazon: MoneyAmazon; focus: string }) {
  const { months, cats } = amazon;
  const slices = months.map((m) =>
    cats
      .map((c) => ({ cat: c, v: Math.max(0, m.byCat[c] ?? 0) }))
      .filter((s) => s.v > 0)
  );
  const top = Math.max(
    1,
    ...slices.map((ss) => ss.reduce((n, s) => n + s.v, 0))
  );
  const slots = Math.max(6, months.length);
  const first = slots - months.length;
  const spoken = months
    .map((m) => `${m.label}${m.partial ? " so far" : ""} ${usd(m.total)}`)
    .join(", ");
  return (
    <svg
      role="img"
      aria-label={`Amazon spending per month: ${spoken}`}
      viewBox={`0 0 ${slots * (BAR_W + BAR_GAP)} ${BAR_H}`}
      preserveAspectRatio="none"
      className="block h-32 w-full"
    >
      {slices.map((ss, i) => {
        let y = BAR_H;
        return (
          <g
            key={months[i].m}
            className={months[i].partial ? "opacity-50" : ""}
          >
            {ss.map((s) => {
              const h = (s.v / top) * BAR_H;
              y -= h;
              const ci = colorIndex(cats, s.cat);
              return (
                <rect
                  key={s.cat}
                  x={(first + i) * (BAR_W + BAR_GAP)}
                  y={y}
                  width={BAR_W}
                  height={h}
                  className={`${ci < 0 ? OTHER_FILL : FILLS[ci]} ${
                    focus && focus !== s.cat ? "opacity-25" : ""
                  }`}
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

/** How many items show before "Show all". */
const FIRST_ITEMS = 30;

/** Amazon: per-month bars by category, repeat buys and the items. */
export function AmazonSection({ amazon }: { amazon: MoneyAmazon }) {
  const [cat, setCat] = useState("");
  const [all, setAll] = useState(false);
  const items = cat
    ? amazon.items.filter((t) => t.category === cat)
    : amazon.items;
  const shown = all ? items : items.slice(0, FIRST_ITEMS);
  const first = amazon.months[0];
  const last = amazon.months[amazon.months.length - 1];

  return (
    <Section title="Amazon">
      <div className="jim-card space-y-3 px-4 py-3.5">
        <AmazonBars amazon={amazon} focus={cat} />
        <div className="flex justify-between gap-3 text-xs text-ayu-subtle tabular-nums">
          <span>{first.label}</span>
          {amazon.months.length > 1 && (
            <span>
              {last.label}
              {last.partial ? ", so far" : ""}
            </span>
          )}
        </div>
        {amazon.cats.length > 0 && (
          <div
            role="group"
            aria-label="Filter items by category"
            className="flex flex-wrap gap-1.5"
          >
            {amazon.cats.map((c) => {
              const ci = colorIndex(amazon.cats, c);
              return (
                <span key={c} className="inline-flex items-center gap-1">
                  <span
                    aria-hidden="true"
                    className={`size-2.5 shrink-0 rounded-sm ${ci < 0 ? OTHER_SWATCH : SWATCHES[ci]}`}
                  />
                  <FilterChip
                    label={c}
                    on={cat === c}
                    onToggle={() => {
                      setCat(cat === c ? "" : c);
                      setAll(false);
                    }}
                  />
                </span>
              );
            })}
          </div>
        )}
      </div>

      {amazon.repeats.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-ayu-subtle">Bought again</h3>
          <Rows>
            {amazon.repeats.map((r) => (
              <li
                key={`${r.item}-${r.category}`}
                className="flex items-baseline gap-3 px-4 py-2.5"
              >
                <span className="w-8 shrink-0 text-sm text-ayu-subtle tabular-nums">
                  {r.n}×
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-ayu-text [overflow-wrap:anywhere]">
                    {r.item}
                  </span>
                  <span className="block text-xs text-ayu-subtle">
                    {r.category}
                  </span>
                </span>
                <span className="shrink-0 text-ayu-text tabular-nums">
                  {usd(r.total)}
                </span>
              </li>
            ))}
          </Rows>
        </div>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-ayu-subtle">
          {cat ? `${cat} items` : "Items"}{" "}
          <span className="tabular-nums">{items.length}</span>
        </h3>
        {shown.length ? (
          <Rows>
            {shown.map((t, i) => {
              const refund = t.amount > 0;
              return (
                <li
                  key={`${t.date}-${i}`}
                  className="flex items-baseline gap-3 px-4 py-2.5"
                >
                  <span className="w-12 shrink-0 text-sm text-ayu-subtle tabular-nums">
                    {ISO.test(t.date) ? fmtShort(t.date) : t.date}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-ayu-text [overflow-wrap:anywhere]">
                      {t.item}
                    </span>
                    {!cat && (
                      <span className="block text-xs text-ayu-subtle">
                        {t.category}
                      </span>
                    )}
                  </span>
                  <span
                    className={`shrink-0 tabular-nums ${refund ? "text-ayu-green" : "text-ayu-text"}`}
                  >
                    {refund ? `+${usd(t.amount)}` : usd(-t.amount)}
                    {refund && <span className="sr-only"> refund</span>}
                  </span>
                </li>
              );
            })}
          </Rows>
        ) : (
          <Empty>No items in this category.</Empty>
        )}
        {!all && items.length > FIRST_ITEMS && (
          <button
            type="button"
            onClick={() => setAll(true)}
            className="min-h-11 rounded-full px-4 font-medium text-ayu-accent hover:bg-white/[0.06]"
          >
            Show all {items.length}
          </button>
        )}
      </div>
    </Section>
  );
}
