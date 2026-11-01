import type { Ref } from "react";
import { formatNumber } from "@/lib/ever-onward/engine/format";
import type { RateTrend } from "@/lib/ever-onward/engine/rate";
import type { RunState, UniverseDef } from "@/lib/ever-onward/engine/types";
import AnimatedValue from "./AnimatedValue";
import EffectFloater, { type Effect } from "./EffectFloater";
import RateReadout from "./RateReadout";
import SpendFloater, { type Spend } from "./SpendFloater";

interface ResourcesProps {
  def: UniverseDef;
  run: RunState;
  /** The phase's main currency, shown big and first. */
  primaryId: string;
  /** Its smoothed net change per second (gains minus running costs). */
  rate: number;
  trend: RateTrend;
  spend: Spend | null;
  /** What the upgrade just bought changed. */
  effect: Effect | null;
  /** Watched to know when the main readout has scrolled away. */
  primaryRef: Ref<HTMLDivElement>;
}

function formatResource(id: string, value: number): string {
  if (id === "night") return `${value.toFixed(1)}%`;
  if (id === "oilPrice") return value.toFixed(2);
  return formatNumber(Math.floor(value));
}

export default function Resources({
  def,
  run,
  primaryId,
  rate,
  trend,
  spend,
  effect,
  primaryRef,
}: ResourcesProps) {
  const phaseId = def.phases[run.phase].id;
  const shown = def.resources.filter(
    (r) => r.phases === undefined || r.phases.includes(phaseId)
  );
  const primary = shown.find((r) => r.id === primaryId);
  const others = shown.filter((r) => r.id !== primaryId);
  return (
    <dl
      aria-label="Resources"
      className="grid grid-cols-2 gap-2 sm:grid-cols-3"
    >
      {primary && (
        <div
          ref={primaryRef}
          className="relative col-span-2 flex items-end justify-between gap-3 rounded-xl border border-amber-300 bg-white px-4 py-3 sm:col-span-3 dark:border-amber-700 dark:bg-slate-900"
        >
          <div className="min-w-0">
            <dt className="truncate text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
              {primary.label}
            </dt>
            <dd className="text-4xl font-bold leading-tight text-slate-900 dark:text-slate-50">
              <AnimatedValue
                value={run.resources[primary.id] ?? 0}
                format={(v) => formatResource(primary.id, v)}
                testId={`lm-res-${primary.id}`}
              />
            </dd>
          </div>
          <dd className="shrink-0 pb-1 text-base font-semibold">
            <RateReadout rate={rate} trend={trend} testId="lm-rate" />
          </dd>
          <dd className="contents">
            <SpendFloater spend={spend} />
            <EffectFloater effect={effect} />
          </dd>
        </div>
      )}
      {others.map((r) => (
        <div
          key={r.id}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900"
        >
          <dt className="truncate text-xs text-slate-600 dark:text-slate-400">
            {r.label}
          </dt>
          <dd className="text-lg font-semibold text-slate-900 dark:text-slate-50">
            <AnimatedValue
              value={run.resources[r.id] ?? 0}
              format={(v) => formatResource(r.id, v)}
              testId={`lm-res-${r.id}`}
            />
          </dd>
        </div>
      ))}
    </dl>
  );
}
