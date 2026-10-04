"use client";

import {
  BedDouble,
  Gauge,
  HardHat,
  LifeBuoy,
  Scale,
  ShieldCheck,
  Users,
  UsersRound,
  Weight,
  type LucideIcon,
} from "lucide-react";
import { useMemo } from "react";
import {
  computeStats,
  TITANIC_REFERENCE,
  type CoverageLevel,
  type Stability,
} from "@/lib/ship-builder/model/stats";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { warningIcons } from "./icons/warningIcons";

const COVERAGE_CLASSES: Record<CoverageLevel, string> = {
  red: "text-red-600 dark:text-red-400",
  amber: "text-amber-600 dark:text-amber-400",
  green: "text-emerald-600 dark:text-emerald-400",
};

const STABILITY_CLASSES: Record<Stability, string> = {
  Stable: "text-emerald-600 dark:text-emerald-400",
  "Top-heavy": "text-amber-600 dark:text-amber-400",
  Dangerous: "text-red-600 dark:text-red-400",
};

const fmt = (n: number) => n.toLocaleString("en-US");

// Plain rounding would show 100% for 0.996 while the ship is still short of
// seats, so anything below full coverage caps at 99%.
function formatCoverage(coverage: number): string {
  const percent = Math.round(coverage * 100);
  return `${coverage < 1 ? Math.min(percent, 99) : percent}%`;
}

interface StatRowProps {
  Icon: LucideIcon;
  label: string;
  testId: string;
  value: string;
  unit?: string;
  detail?: string;
  valueClass?: string;
}

function StatRow({
  Icon,
  label,
  testId,
  value,
  unit,
  detail,
  valueClass,
}: StatRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        {label}
      </dt>
      <dd className="text-right">
        <span
          data-testid={testId}
          className={`font-mono text-sm font-semibold ${valueClass ?? ""}`}
        >
          {value}
        </span>
        {unit && (
          <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">
            {unit}
          </span>
        )}
        {detail && (
          <span className="block text-xs text-slate-500 dark:text-slate-400">
            {detail}
          </span>
        )}
      </dd>
    </div>
  );
}

export default function StatsPanel() {
  const ship = useShipBuilderStore((s) => s.ship);
  const stats = useMemo(() => computeStats(ship), [ship]);
  const { passengers } = stats;

  return (
    <div className="space-y-5 p-4">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Stats
        </h2>
        <dl className="mt-2 divide-y divide-slate-200 dark:divide-slate-800">
          <StatRow
            Icon={Users}
            label="Passengers"
            testId="stat-passengers"
            value={fmt(passengers.total)}
            detail={`1st ${fmt(passengers.first)} · 2nd ${fmt(passengers.second)} · 3rd ${fmt(passengers.third)}`}
          />
          <StatRow
            Icon={HardHat}
            label="Crew"
            testId="stat-crew"
            value={fmt(stats.crew)}
          />
          <StatRow
            Icon={BedDouble}
            label="Crew beds"
            testId="stat-crew-beds"
            value={fmt(stats.crewBerths)}
            detail={`of ${fmt(stats.crew)} crew`}
          />
          <StatRow
            Icon={UsersRound}
            label="People aboard"
            testId="stat-people"
            value={fmt(stats.peopleAboard)}
          />
          <StatRow
            Icon={LifeBuoy}
            label="Lifeboat seats"
            testId="stat-seats"
            value={fmt(stats.lifeboatSeats)}
            detail={`${stats.lifeboats} boats`}
          />
          <StatRow
            Icon={ShieldCheck}
            label="Coverage"
            testId="stat-coverage"
            value={formatCoverage(stats.coverage)}
            valueClass={COVERAGE_CLASSES[stats.coverageLevel]}
          />
          <StatRow
            Icon={Weight}
            label="Gross tonnage"
            testId="stat-tonnage"
            value={fmt(stats.grossTonnage)}
            unit="GRT"
          />
          <StatRow
            Icon={Gauge}
            label="Top speed"
            testId="stat-speed"
            value={String(stats.topSpeedKnots)}
            unit="kn"
          />
          <StatRow
            Icon={Scale}
            label="Stability"
            testId="stat-stability"
            value={stats.stability}
            valueClass={STABILITY_CLASSES[stats.stability]}
          />
        </dl>
      </div>

      {stats.warnings.length > 0 && (
        <ul aria-label="Warnings" className="space-y-1.5">
          {stats.warnings.map((warning) => {
            const WarningIcon = warningIcons[warning.code];
            return (
              <li
                key={warning.code}
                className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
              >
                <WarningIcon
                  data-testid="warning-icon"
                  aria-hidden="true"
                  className="h-5 w-5 shrink-0"
                />
                <span>{warning.message}</span>
              </li>
            );
          })}
        </ul>
      )}

      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          RMS Titanic (1912)
        </h2>
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
          <dt>Tonnage</dt>
          <dd className="text-right font-mono">
            {fmt(TITANIC_REFERENCE.grossTonnage)}
          </dd>
          <dt>Speed</dt>
          <dd className="text-right font-mono">
            {TITANIC_REFERENCE.topSpeedKnots} kn
          </dd>
          <dt>Lifeboats</dt>
          <dd className="text-right font-mono">
            {TITANIC_REFERENCE.lifeboats} (
            {fmt(TITANIC_REFERENCE.lifeboatSeats)} seats)
          </dd>
          <dt>Aboard</dt>
          <dd className="text-right font-mono">
            {fmt(TITANIC_REFERENCE.peopleAboard)}
          </dd>
        </dl>
      </div>
    </div>
  );
}
