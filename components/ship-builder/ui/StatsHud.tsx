"use client";

import { useMemo } from "react";
import { analyzeShip } from "@/lib/ship-builder/model/analysis";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { COVERAGE_CLASSES, formatCoverage } from "./StatsPanel";

/**
 * Compact stats summary for the small-screen Stats drawer toggle. It is
 * rendered inside a button, so it is spans only and aria-hidden: the button
 * keeps the accessible name "Stats" and the panel it opens has the same
 * numbers in full.
 */
export default function StatsHud() {
  const ship = useShipBuilderStore((s) => s.ship);
  const stats = useMemo(() => analyzeShip(ship).stats, [ship]);
  const done = stats.checks.filter((check) => check.ok).length;
  const allDone = done === stats.checks.length;

  return (
    <span
      data-testid="stats-hud"
      aria-hidden="true"
      className="flex items-center gap-2 whitespace-nowrap font-mono text-xs font-semibold text-slate-600 dark:text-slate-300"
    >
      <span
        className={
          allDone
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-amber-600 dark:text-amber-400"
        }
      >
        ✓ {done}/{stats.checks.length}
      </span>
      <span>{stats.topSpeedKnots} kn</span>
      <span>
        {stats.peopleAboard.toLocaleString("en-US")}
        <span className="hidden sm:inline"> aboard</span>
      </span>
      <span className={COVERAGE_CLASSES[stats.coverageLevel]}>
        {formatCoverage(stats.coverage)}
      </span>
    </span>
  );
}
