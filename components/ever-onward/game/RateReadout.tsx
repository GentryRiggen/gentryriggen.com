import { formatNumber } from "@/lib/ever-onward/engine/format";
import type { RateTrend } from "@/lib/ever-onward/engine/rate";

interface RateReadoutProps {
  rate: number;
  trend: RateTrend;
  testId: string;
  className?: string;
}

/** "+12/s", or "−3.4/s" when the lamp costs more than it earns. */
export const formatRate = (rate: number): string =>
  `${rate < 0 ? "−" : "+"}${formatNumber(Math.abs(rate))}/s`;

const ARROWS: Record<RateTrend, string> = { up: "▲", down: "▼", flat: "" };

/** Green and rising, red when falling or negative, calm when steady. */
export default function RateReadout({
  rate,
  trend,
  testId,
  className = "",
}: RateReadoutProps) {
  const tone =
    rate < 0 || trend === "down"
      ? "text-red-700 dark:text-red-400"
      : trend === "up"
        ? "text-emerald-700 dark:text-emerald-400"
        : "text-slate-700 dark:text-slate-300";
  return (
    <span
      data-testid={testId}
      data-trend={trend}
      className={`tabular-nums transition-colors ${tone} ${className}`}
    >
      <span className="sr-only">Net per second </span>
      {formatRate(rate)}
      <span aria-hidden="true" className="ml-1 text-xs">
        {ARROWS[trend]}
      </span>
    </span>
  );
}
