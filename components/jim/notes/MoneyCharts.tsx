import { fmtShort } from "@/lib/jim/todos";
import type { CheckinPlanRow, MoneyCash, MoneyMonth } from "@/lib/jim/money";

/**
 * The Money page's charts, in plain SVG (no chart library): each stretches
 * to its card, so a phone at 320px fits every one.
 */

const DOLLARS = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const CENTS = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * "$1,234", "−$80" (a true minus sign), "+$340" with `sign`. Whole dollars
 * unless `cents` and the amount has some.
 */
export function usd(
  n: number,
  { sign = false, cents = false }: { sign?: boolean; cents?: boolean } = {}
): string {
  const withCents = cents && Math.round(Math.abs(n) * 100) % 100 !== 0;
  const abs = withCents
    ? Math.round(Math.abs(n) * 100) / 100
    : Math.round(Math.abs(n));
  const text = (withCents ? CENTS : DOLLARS).format(abs);
  if (abs === 0) return text;
  if (n < 0) return `−${text}`;
  return sign ? `+${text}` : text;
}

/** "Oct" or "Oct, so far" for a month still in progress. */
export function monthName(m: MoneyMonth): string {
  return m.partial ? `${m.label}, so far` : m.label;
}

/** Drawing units: each column is COL wide with GAP between. */
const COL = 10;
const GAP = 3;
const H = 100;
/** Fewer columns than this sit at the right, by the newest edge, rather
 * than stretching wide. */
const MIN_SLOTS = 12;

interface ChartEndsProps {
  first: string;
  last: string;
  /** How many columns the chart drew. */
  count: number;
}

/** The labels under a column chart: at each end when the columns fill it,
 * else together on the right, where a short series sits. */
export function ChartEnds({ first, last, count }: ChartEndsProps) {
  const fills = count >= MIN_SLOTS;
  return (
    <div
      className={`flex gap-3 text-xs text-ayu-subtle tabular-nums ${
        fills ? "justify-between" : "justify-end"
      }`}
    >
      {fills ? (
        <>
          <span>{first}</span>
          <span>{last}</span>
        </>
      ) : (
        <span>{count > 1 ? `${first} – ${last}` : last}</span>
      )}
    </div>
  );
}

interface NetChartProps {
  /** Oldest first. */
  months: MoneyMonth[];
  /** The month picked below (YYYY-MM), shaded behind its bar. */
  selected: string;
}

/** Net per month as diverging columns: surplus up in green, deficit down
 * in red, around a zero line. A month in progress is dimmer. */
export function NetChart({ months, selected }: NetChartProps) {
  const up = Math.max(0, ...months.map((m) => m.net));
  const down = Math.max(0, ...months.map((m) => -m.net));
  const span = up + down;
  const zero = span ? (up / span) * H : H / 2;
  const slots = Math.max(MIN_SLOTS, months.length);
  const width = slots * COL;
  const first = slots - months.length;
  return (
    <svg
      role="group"
      aria-label="Net per month"
      viewBox={`0 0 ${width} ${H}`}
      preserveAspectRatio="none"
      className="block h-36 w-full"
    >
      {months.map((m, i) => {
        const h = span ? Math.max(0.75, (Math.abs(m.net) / span) * H) : 0.75;
        const y = m.net >= 0 ? zero - h : zero;
        const label = `${monthName(m)}: ${usd(m.net, { sign: true })}${
          m.flag ? `, ${m.flag}` : ""
        }`;
        return (
          <g key={m.m} role="img" aria-label={label}>
            <title>{label}</title>
            {m.m === selected && (
              <rect
                x={(first + i) * COL}
                y={0}
                width={COL}
                height={H}
                className="fill-white/[0.07]"
              />
            )}
            <rect
              x={(first + i) * COL + GAP / 2}
              y={y}
              width={COL - GAP}
              height={h}
              className={`${m.net >= 0 ? "fill-ayu-green" : "fill-ayu-red"} ${
                m.partial ? "opacity-45" : ""
              }`}
            />
          </g>
        );
      })}
      <rect
        x={0}
        y={zero - 0.3}
        width={width}
        height={0.6}
        className="fill-white/25"
      />
    </svg>
  );
}

interface MeterProps {
  /** The bar's length, 0–1 of the track. */
  value: number;
  /** A tick across the track (0–1), e.g. a target. */
  tick?: number;
  fill: string;
}

/** A thin horizontal bar on a faint track. */
function Meter({ value, tick, fill }: MeterProps) {
  const v = Math.min(1, Math.max(0, value)) * 100;
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 10"
      preserveAspectRatio="none"
      className="block h-2.5 w-full overflow-visible"
    >
      <rect
        x={0}
        y={2}
        width={100}
        height={6}
        rx={3}
        className="fill-white/[0.06]"
      />
      {v > 0 && (
        <rect x={0} y={2} width={v} height={6} rx={3} className={fill} />
      )}
      {tick !== undefined && (
        <rect
          x={Math.min(99, Math.max(0, tick * 100 - 0.5))}
          y={0}
          width={1}
          height={10}
          className="fill-ayu-text"
        />
      )}
    </svg>
  );
}

interface GroupBarsProps {
  /** Group names in display order, then amounts spent. */
  rows: [string, number][];
}

/** Spent by group: one bar each, scaled to the biggest. */
export function GroupBars({ rows }: GroupBarsProps) {
  const top = Math.max(1, ...rows.map(([, n]) => n));
  return (
    <ul className="space-y-2.5">
      {rows.map(([group, n]) => (
        <li key={group} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 text-ayu-text [overflow-wrap:anywhere]">
              {group}
            </span>
            <span className="shrink-0 text-ayu-subtle tabular-nums">
              {usd(n)}
            </span>
          </div>
          <Meter value={n / top} fill="fill-ayu-accent" />
        </li>
      ))}
    </ul>
  );
}

/** One plan row: actual against target, with a tick at the target. Over
 * the target is red. */
export function PlanBar({ row }: { row: CheckinPlanRow }) {
  const over = row.actual > row.target;
  const scale = Math.max(1, row.target, row.actual);
  const label = `${row.cat}: ${usd(row.actual)} of ${usd(row.target)}${
    over ? `, over by ${usd(row.actual - row.target)}` : ""
  }`;
  return (
    <div role="img" aria-label={label} className="space-y-1">
      <div
        aria-hidden="true"
        className="flex items-baseline justify-between gap-3 text-sm"
      >
        <span className="min-w-0 text-ayu-text [overflow-wrap:anywhere]">
          {row.cat}
        </span>
        <span
          className={`shrink-0 tabular-nums ${over ? "text-ayu-red" : "text-ayu-subtle"}`}
        >
          {usd(row.actual)} of {usd(row.target)}
        </span>
      </div>
      <Meter
        value={row.actual / scale}
        tick={row.target / scale}
        fill={over ? "fill-ayu-red" : "fill-ayu-green"}
      />
    </div>
  );
}

/** Cash on hand by statement: small columns from zero. */
export function CashChart({ cash }: { cash: MoneyCash[] }) {
  const top = Math.max(1, ...cash.map((c) => c.amount));
  const slots = Math.max(MIN_SLOTS, cash.length);
  const width = slots * COL;
  const first = slots - cash.length;
  return (
    <svg
      role="group"
      aria-label="Cash by statement"
      viewBox={`0 0 ${width} ${H}`}
      preserveAspectRatio="none"
      className="block h-24 w-full"
    >
      {cash.map((c, i) => {
        const h = Math.max(0.75, (Math.max(0, c.amount) / top) * H);
        const label = `${fmtShort(c.date)}: ${usd(c.amount)}`;
        return (
          <g key={c.date} role="img" aria-label={label}>
            <title>{label}</title>
            <rect
              x={(first + i) * COL + GAP / 2}
              y={H - h}
              width={COL - GAP}
              height={h}
              className={
                i === cash.length - 1 ? "fill-ayu-cyan" : "fill-ayu-cyan/45"
              }
            />
          </g>
        );
      })}
    </svg>
  );
}
