import type { DayPoint } from "@/lib/analytics/aggregate";

const W = 600;
const H = 160;
const PAD = 4;

export default function TimeSeriesChart({ series }: { series: DayPoint[] }) {
  const max = Math.max(1, ...series.map((p) => p.views));
  const step = W / Math.max(1, series.length);
  const barWidth = Math.max(1, step - 2);
  const y = (value: number) => H - PAD - (value / max) * (H - 2 * PAD);
  const line = series
    .map(
      (p, i) =>
        `${(i * step + step / 2).toFixed(1)},${y(p.visitors).toFixed(1)}`
    )
    .join(" ");

  return (
    <figure>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Views and visitors per day"
        className="h-40 w-full"
      >
        {series.map((p, i) => (
          <rect
            key={p.date}
            x={i * step + 1}
            y={y(p.views)}
            width={barWidth}
            height={H - PAD - y(p.views)}
            className="fill-blue-500/70 dark:fill-blue-400/70"
          >
            <title>{`${p.date}: ${p.views} views, ${p.visitors} visitors`}</title>
          </rect>
        ))}
        <polyline
          points={line}
          fill="none"
          strokeWidth={2}
          className="stroke-emerald-500 dark:stroke-emerald-400"
        />
      </svg>
      <figcaption className="mt-1 flex gap-4 text-xs text-gray-600 dark:text-gray-400">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-blue-500 dark:bg-blue-400" />
          Views
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-3 bg-emerald-500 dark:bg-emerald-400" />
          Daily visitors
        </span>
        <span className="ml-auto">UTC days</span>
      </figcaption>
    </figure>
  );
}
