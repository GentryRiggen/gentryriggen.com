import type { Count } from "@/lib/analytics/aggregate";

interface BreakdownListProps {
  title: string;
  rows: Count[];
}

export default function BreakdownList({ title, rows }: BreakdownListProps) {
  const max = Math.max(1, ...rows.map((r) => r.views));
  return (
    <section className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <h3 className="mb-3 text-sm font-medium text-gray-600 dark:text-gray-400">
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">No data</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.key} className="text-sm">
              <div className="flex justify-between gap-2">
                <span className="truncate">{row.key}</span>
                <span className="tabular-nums text-gray-600 dark:text-gray-400">
                  {row.views.toLocaleString()}
                </span>
              </div>
              <progress
                className="mt-1 block h-1 w-full overflow-hidden rounded [&::-moz-progress-bar]:bg-blue-500 [&::-webkit-progress-bar]:bg-gray-100 dark:[&::-webkit-progress-bar]:bg-gray-800 [&::-webkit-progress-value]:bg-blue-500 dark:[&::-webkit-progress-value]:bg-blue-400"
                value={row.views}
                max={max}
                aria-label={`${row.key}: ${row.views} views`}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
