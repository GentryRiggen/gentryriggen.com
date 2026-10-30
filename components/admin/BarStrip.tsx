export interface Bar {
  label: string;
  value: number;
}

interface BarStripProps {
  title: string;
  bars: Bar[];
  /** What a bar counts, for the hover text and screen readers. */
  unit: string;
  /** Labels under the first and last bar (for example "0 m" and "850 m"). */
  startLabel: string;
  endLabel: string;
}

const W = 600;
const H = 80;
const PAD = 2;

/** A small bar chart in the same style as TimeSeriesChart. Text values only. */
export default function BarStrip({
  title,
  bars,
  unit,
  startLabel,
  endLabel,
}: BarStripProps) {
  const max = Math.max(1, ...bars.map((bar) => bar.value));
  const step = W / Math.max(1, bars.length);
  const barWidth = Math.max(1, step - 1);
  const total = bars.reduce((sum, bar) => sum + bar.value, 0);
  return (
    <figure>
      <figcaption className="mb-1 flex justify-between text-xs text-gray-600 dark:text-gray-400">
        <span>{title}</span>
        <span className="tabular-nums">{total.toLocaleString()}</span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}: ${total} ${unit}`}
        className="h-16 w-full"
      >
        {bars.map((bar, i) => {
          const height = (bar.value / max) * (H - 2 * PAD);
          return (
            <rect
              key={bar.label}
              x={i * step}
              y={H - PAD - height}
              width={barWidth}
              height={height}
              className="fill-rose-500/80 dark:fill-rose-400/80"
            >
              <title>{`${bar.label}: ${bar.value} ${unit}`}</title>
            </rect>
          );
        })}
        <line
          x1={0}
          x2={W}
          y1={H - PAD}
          y2={H - PAD}
          strokeWidth={1}
          className="stroke-gray-300 dark:stroke-gray-700"
        />
      </svg>
      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-500">
        <span>{startLabel}</span>
        <span>{endLabel}</span>
      </div>
    </figure>
  );
}
