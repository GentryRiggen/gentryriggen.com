import { pctChange } from "@/lib/analytics/aggregate";

interface StatTileProps {
  label: string;
  value: number;
  /** Null when the previous period can't be compared (e.g. truncated data). */
  previous: number | null;
  testId?: string;
}

export default function StatTile({
  label,
  value,
  previous,
  testId,
}: StatTileProps) {
  const change = previous === null ? null : pctChange(value, previous);
  return (
    <div
      data-testid={testId}
      className="rounded-lg border border-gray-200 p-4 dark:border-gray-800"
    >
      <div className="text-sm text-gray-600 dark:text-gray-400">{label}</div>
      <div className="mt-1 text-3xl font-semibold tabular-nums">
        {value.toLocaleString()}
      </div>
      <div
        className={
          change === null
            ? "mt-1 text-sm text-gray-500 dark:text-gray-500"
            : change >= 0
              ? "mt-1 text-sm text-green-600 dark:text-green-400"
              : "mt-1 text-sm text-red-600 dark:text-red-400"
        }
      >
        {previous === null
          ? "change unavailable"
          : change === null
            ? "no prior data"
            : `${change >= 0 ? "▲" : "▼"} ${Math.abs(change)}% vs previous period`}
      </div>
    </div>
  );
}
