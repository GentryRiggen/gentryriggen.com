interface SparklineProps {
  points: { date: string; v: number }[];
  /** The reference range, drawn as a band where it is known. */
  lo?: number | null;
  hi?: number | null;
  /** Read out instead of the picture. */
  label: string;
}

const W = 200;
const H = 40;
const PAD = 5;

/**
 * A small trend line, plain SVG. The lines keep their width when the box
 * stretches (non-scaling strokes), and a zero-length round-capped stroke
 * draws the latest point as a dot that stays round.
 */
export default function Sparkline({ points, lo, hi, label }: SparklineProps) {
  const values = points.map((p) => p.v);
  const bounds = [...values];
  if (lo != null) bounds.push(lo);
  if (hi != null) bounds.push(hi);
  let min = Math.min(...bounds);
  let max = Math.max(...bounds);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const y = (v: number) => PAD + ((max - v) / (max - min)) * (H - 2 * PAD);
  const x = (i: number) =>
    points.length === 1
      ? W / 2
      : PAD + (i / (points.length - 1)) * (W - 2 * PAD);
  const line = points.map((p, i) => `${x(i)},${y(p.v)}`).join(" ");
  const last = points.length - 1;
  const bandTop = hi != null ? y(hi) : 0;
  const bandBottom = lo != null ? y(lo) : H;

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="block h-10 w-full"
    >
      {(lo != null || hi != null) && (
        <rect
          x={0}
          y={bandTop}
          width={W}
          height={Math.max(0, bandBottom - bandTop)}
          className="fill-ayu-green/10"
        />
      )}
      {points.length > 1 && (
        <polyline
          points={line}
          vectorEffect="non-scaling-stroke"
          className="fill-none stroke-ayu-accent stroke-2"
        />
      )}
      {last >= 0 && (
        <path
          d={`M${x(last)} ${y(points[last].v)}h0`}
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          className="stroke-ayu-accent stroke-[7]"
        />
      )}
    </svg>
  );
}
