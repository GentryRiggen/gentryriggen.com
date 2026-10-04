"use client";

import {
  BedDouble,
  CircleCheck,
  Container,
  Gauge,
  HardHat,
  LifeBuoy,
  PartyPopper,
  Scale,
  ShieldCheck,
  Users,
  UsersRound,
  Weight,
  type LucideIcon,
} from "lucide-react";
import { useMemo } from "react";
import { analyzeShip } from "@/lib/ship-builder/model/analysis";
import {
  REFERENCE_SHIPS,
  type ShipKind,
  type ReferenceMetric,
} from "@/lib/ship-builder/model/kinds";
import {
  type CoverageLevel,
  type Stability,
  type Stats,
} from "@/lib/ship-builder/model/stats";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { warningIcons } from "./icons/warningIcons";

export const COVERAGE_CLASSES: Record<CoverageLevel, string> = {
  red: "text-red-600 dark:text-red-400",
  amber: "text-amber-600 dark:text-amber-400",
  green: "text-emerald-600 dark:text-emerald-400",
};

const STABILITY_CLASSES: Record<Stability, string> = {
  Stable: "text-emerald-600 dark:text-emerald-400",
  "Top-heavy": "text-amber-600 dark:text-amber-400",
  Dangerous: "text-red-600 dark:text-red-400",
};

// Tailwind only sees whole class names, so bar widths are a fixed 5% scale
// spelled out in full rather than built from a number.
const BAR_WIDTHS = [
  "w-0",
  "w-[5%]",
  "w-[10%]",
  "w-[15%]",
  "w-[20%]",
  "w-[25%]",
  "w-[30%]",
  "w-[35%]",
  "w-[40%]",
  "w-[45%]",
  "w-[50%]",
  "w-[55%]",
  "w-[60%]",
  "w-[65%]",
  "w-[70%]",
  "w-[75%]",
  "w-[80%]",
  "w-[85%]",
  "w-[90%]",
  "w-[95%]",
  "w-full",
];

/** Width class for a 0..1 fraction; anything above zero stays visible. */
function barWidth(fraction: number): string {
  if (fraction <= 0) return BAR_WIDTHS[0];
  const step = Math.round(Math.min(fraction, 1) * 20);
  return BAR_WIDTHS[Math.max(step, 1)];
}

const fmt = (n: number) => n.toLocaleString("en-US");

// Plain rounding would show 100% for 0.996 while the ship is still short of
// seats, so anything below full coverage caps at 99%.
export function formatCoverage(coverage: number): string {
  const percent = Math.round(coverage * 100);
  return `${coverage < 1 ? Math.min(percent, 99) : percent}%`;
}

const SECTION_HEADING_CLASS =
  "text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400";

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

function Checklist({ checks }: { checks: Stats["checks"] }) {
  const done = checks.filter((check) => check.ok).length;
  const allDone = done === checks.length;
  const fraction = done / checks.length;

  return (
    <section aria-labelledby="stats-checklist-heading">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="stats-checklist-heading" className={SECTION_HEADING_CLASS}>
          Ready to sail?
        </h2>
        <span
          data-testid="checks-progress"
          className="font-mono text-xs font-semibold text-slate-600 dark:text-slate-300"
        >
          {done} of {checks.length} done
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Checklist progress"
        aria-valuemin={0}
        aria-valuemax={checks.length}
        aria-valuenow={done}
        className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
      >
        <div
          className={`h-full rounded-full transition-[width] ${barWidth(fraction)} ${
            allDone
              ? "bg-emerald-500 dark:bg-emerald-400"
              : "bg-sky-500 dark:bg-sky-400"
          }`}
        />
      </div>

      {allDone && (
        <p
          data-testid="ready-to-sail"
          className="mt-3 flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200"
        >
          <PartyPopper
            aria-hidden="true"
            className="h-5 w-5 shrink-0 motion-safe:animate-bounce motion-safe:[animation-iteration-count:3]"
          />
          Ready to sail!
        </p>
      )}

      <ul aria-label="Checklist" className="mt-3 space-y-1.5">
        {checks.map((check) => {
          if (check.ok) {
            return (
              <li
                key={check.code}
                data-testid="check-done"
                className="flex items-center gap-2 px-3 py-1 text-sm text-slate-500 dark:text-slate-400"
              >
                <CircleCheck
                  aria-hidden="true"
                  className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400"
                />
                <span>{check.label}</span>
              </li>
            );
          }
          const WarningIcon = warningIcons[check.code];
          return (
            <li
              key={check.code}
              data-testid="check-todo"
              className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
            >
              <WarningIcon
                data-testid="warning-icon"
                aria-hidden="true"
                className="h-5 w-5 shrink-0"
              />
              <span>
                <span className="block text-sm font-medium">{check.label}</span>
                {check.detail && (
                  <span className="block text-xs">{check.detail}</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function yourValue(stats: Stats, metric: ReferenceMetric): number {
  switch (metric) {
    case "tonnage":
      return stats.grossTonnage;
    case "speed":
      return stats.topSpeedKnots;
    case "seats":
      return stats.lifeboatSeats;
    case "people":
      return stats.peopleAboard;
    case "passengers":
      return stats.passengers.total;
    case "crew":
      return stats.crew;
    case "teu":
      return stats.teu;
  }
}

interface CompareBarProps {
  who: string;
  value: number;
  max: number;
  unit?: string;
  barClass: string;
}

function CompareBar({ who, value, max, unit, barClass }: CompareBarProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-9 shrink-0 text-xs text-slate-500 dark:text-slate-400">
        {who}
      </span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div
          className={`h-full rounded-full ${barWidth(max > 0 ? value / max : 0)} ${barClass}`}
        />
      </div>
      <span className="w-20 shrink-0 text-right font-mono text-xs text-slate-700 dark:text-slate-300">
        {fmt(value)}
        {unit && ` ${unit}`}
      </span>
    </div>
  );
}

function Comparison({ stats, kind }: { stats: Stats; kind: ShipKind }) {
  const reference = REFERENCE_SHIPS[kind];
  return (
    <section aria-labelledby="stats-compare-heading">
      <h2 id="stats-compare-heading" className={SECTION_HEADING_CLASS}>
        You vs {reference.title}
      </h2>
      <ul data-testid="reference-ship" className="mt-2 space-y-3">
        {reference.figures.map((figure) => {
          const yours = yourValue(stats, figure.metric);
          const max = Math.max(yours, figure.value);
          return (
            <li key={figure.metric}>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {figure.label}
              </p>
              <div className="mt-1 space-y-1">
                <CompareBar
                  who="You"
                  value={yours}
                  max={max}
                  unit={figure.unit}
                  barClass="bg-sky-500 dark:bg-sky-400"
                />
                <CompareBar
                  who="Real"
                  value={figure.value}
                  max={max}
                  unit={figure.unit}
                  barClass="bg-slate-400 dark:bg-slate-500"
                />
              </div>
            </li>
          );
        })}
      </ul>
      {reference.note && (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {reference.note}
        </p>
      )}
    </section>
  );
}

export default function StatsPanel() {
  const ship = useShipBuilderStore((s) => s.ship);
  const stats = useMemo(() => analyzeShip(ship).stats, [ship]);
  const { passengers } = stats;

  return (
    <div className="space-y-5 p-4">
      <Checklist checks={stats.checks} />

      <section aria-labelledby="stats-people-heading">
        <h3 id="stats-people-heading" className={SECTION_HEADING_CLASS}>
          People
        </h3>
        <dl className="mt-1 divide-y divide-slate-200 dark:divide-slate-800">
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
        </dl>
      </section>

      <section aria-labelledby="stats-ship-heading">
        <h3 id="stats-ship-heading" className={SECTION_HEADING_CLASS}>
          Ship
        </h3>
        <dl className="mt-1 divide-y divide-slate-200 dark:divide-slate-800">
          {stats.teu > 0 && (
            <StatRow
              Icon={Container}
              label="Cargo"
              testId="stat-cargo"
              value={fmt(stats.teu)}
              unit="TEU"
            />
          )}
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
      </section>

      <Comparison stats={stats} kind={ship.kind} />
    </div>
  );
}
