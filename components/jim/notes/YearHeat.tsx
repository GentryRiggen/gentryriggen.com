import type { HeatLevel, HeatWeek } from "@/lib/jim/training";

interface YearHeatProps {
  weeks: HeatWeek[];
  /** Read out instead of the picture ("Trained 40 days in the past year"). */
  label: string;
  /** What each shade means, left to right from level 1. */
  legend: [string, string, string];
}

const CELL = 10;
const GAP = 2;

const FILLS: Record<HeatLevel, string> = {
  0: "fill-white/[0.06]",
  1: "fill-ayu-accent/30",
  2: "fill-ayu-accent/65",
  3: "fill-ayu-accent",
};

const SWATCH: Record<1 | 2 | 3, string> = {
  1: "bg-ayu-accent/30",
  2: "bg-ayu-accent/65",
  3: "bg-ayu-accent",
};

/**
 * A year of days as a contribution-style strip, plain SVG that scales to
 * its card. A picture only: the days themselves are linked in the lists.
 */
export default function YearHeat({ weeks, label, legend }: YearHeatProps) {
  const width = weeks.length * (CELL + GAP) - GAP;
  const height = 7 * (CELL + GAP) - GAP;
  return (
    <div className="jim-card space-y-2 px-3 py-3">
      <svg
        role="img"
        aria-label={label}
        viewBox={`0 0 ${width} ${height}`}
        className="block h-auto w-full"
      >
        {weeks.map((w, x) =>
          w.days.map((d, y) =>
            d ? (
              <rect
                key={d.date}
                x={x * (CELL + GAP)}
                y={y * (CELL + GAP)}
                width={CELL}
                height={CELL}
                rx={2}
                className={FILLS[d.level]}
              />
            ) : null
          )
        )}
      </svg>
      <p
        aria-hidden="true"
        className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ayu-subtle"
      >
        {([1, 2, 3] as const).map((lv) => (
          <span key={lv} className="inline-flex items-center gap-1">
            <span className={`size-2.5 rounded-sm ${SWATCH[lv]}`} />
            {legend[lv - 1]}
          </span>
        ))}
      </p>
    </div>
  );
}
