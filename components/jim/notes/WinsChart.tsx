import { fmtShort } from "@/lib/jim/todos";
import type { WinsWeek } from "@/lib/jim/view";

interface WinsChartProps {
  /** Oldest first; the last twelve show. */
  weeks: WinsWeek[];
  /** Up to three show, stacked bottom up in this order. */
  keys: string[];
}

const MAX_WEEKS = 12;
const MAX_KEYS = 3;
const SWATCHES = ["bg-ayu-accent", "bg-ayu-cyan", "bg-ayu-purple"];
const FILLS = ["fill-ayu-accent", "fill-ayu-cyan", "fill-ayu-purple"];
/** Drawing units: each week is a column COL wide with GAP between. */
const COL = 10;
const GAP = 3;
const H = 100;

function wins(n: number): string {
  return `${n} ${n === 1 ? "win" : "wins"}`;
}

/** Stacked columns in plain SVG: one per week, one band per key. */
export default function WinsChart({ weeks, keys }: WinsChartProps) {
  const shown = weeks.slice(-MAX_WEEKS);
  const series = keys.slice(0, MAX_KEYS);
  const count = (w: WinsWeek, k: string) => {
    const n = w.counts[k];
    return typeof n === "number" && n > 0 ? n : 0;
  };
  const totals = shown.map((w) => series.reduce((s, k) => s + count(w, k), 0));
  const peak = Math.max(0, ...totals);
  const top = Math.max(1, peak);

  return (
    <div className="jim-card space-y-3 px-4 py-3.5">
      <ul aria-label="Legend" className="flex flex-wrap gap-x-4 gap-y-1">
        {series.map((k, i) => (
          <li key={k} className="flex min-w-0 items-center gap-1.5 text-sm">
            <span
              aria-hidden="true"
              className={`size-2.5 shrink-0 rounded-sm ${SWATCHES[i]}`}
            />
            <span className="truncate text-ayu-text">{k}</span>
          </li>
        ))}
      </ul>
      <svg
        role="group"
        aria-label="Wins by week"
        viewBox={`0 0 ${MAX_WEEKS * COL} ${H}`}
        preserveAspectRatio="none"
        className="block h-32 w-full"
      >
        {shown.map((w, i) => {
          const label = `Week of ${fmtShort(w.week)}: ${wins(totals[i])}${
            totals[i]
              ? ` (${series.map((k) => `${k} ${count(w, k)}`).join(", ")})`
              : ""
          }`;
          // Right-aligned, so a short history sits by the newest edge.
          const x = (MAX_WEEKS - shown.length + i) * COL + GAP / 2;
          let y = H;
          return (
            <g key={w.week} role="img" aria-label={label}>
              <title>{label}</title>
              {totals[i] === 0 ? (
                <rect
                  x={x}
                  y={H - 1}
                  width={COL - GAP}
                  height={1}
                  className="fill-white/10"
                />
              ) : (
                series.map((k, j) => {
                  const h = (count(w, k) / top) * H;
                  if (!h) return null;
                  y -= h;
                  return (
                    <rect
                      key={k}
                      x={x}
                      y={y}
                      width={COL - GAP}
                      height={h}
                      className={FILLS[j]}
                    />
                  );
                })
              )}
            </g>
          );
        })}
      </svg>
      {shown.length > 0 && (
        <div className="flex justify-between text-xs text-ayu-subtle tabular-nums">
          <span>{fmtShort(shown[0].week)}</span>
          <span>{peak > 0 ? `Most ${wins(peak)} a week` : "No wins yet"}</span>
          <span>{fmtShort(shown[shown.length - 1].week)}</span>
        </div>
      )}
    </div>
  );
}
