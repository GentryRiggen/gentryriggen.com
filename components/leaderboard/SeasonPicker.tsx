"use client";

interface SeasonPickerProps {
  /** The season now running; the list runs from it back to season 1. */
  current: number;
  value: number;
  onChange: (season: number) => void;
}

/** Picks which season's board to show, the current one or a past one. */
export default function SeasonPicker({
  current,
  value,
  onChange,
}: SeasonPickerProps) {
  const seasons = Array.from({ length: current }, (_, i) => current - i);
  return (
    <label className="flex items-center gap-2 text-sm font-semibold">
      Season
      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="min-h-11 flex-1 rounded-lg border border-slate-300 bg-white px-2 text-base text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-700 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-sky-300 dark:focus-visible:ring-offset-slate-900"
      >
        {seasons.map((n) => (
          <option key={n} value={n}>
            {n === current ? `Season ${n} (now)` : `Season ${n}`}
          </option>
        ))}
      </select>
    </label>
  );
}
