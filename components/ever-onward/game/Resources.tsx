import type { Ref } from "react";
import { formatNumber } from "@/lib/ever-onward/engine/format";
import type { RateTrend } from "@/lib/ever-onward/engine/rate";
import type { RunState, UniverseDef } from "@/lib/ever-onward/engine/types";
import AnimatedValue from "./AnimatedValue";
import EffectFloater, { type Effect } from "./EffectFloater";
import RateReadout from "./RateReadout";
import {
  pixelClass,
  retroInsetClass,
  retroLabelClass,
  retroPanelClass,
} from "./retro/retroStyles";
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
          className={`${retroPanelClass} relative col-span-2 flex flex-wrap items-end justify-between gap-x-3 gap-y-2 px-4 py-3 sm:col-span-3`}
        >
          <div className="min-w-0">
            <dt className={`${retroLabelClass} truncate`}>{primary.label}</dt>
            <dd
              className={`${pixelClass} mt-2 text-2xl leading-tight text-amber-100 [text-shadow:2px_2px_0_#78350f] sm:text-3xl`}
            >
              <AnimatedValue
                value={run.resources[primary.id] ?? 0}
                format={(v) => formatResource(primary.id, v)}
                testId={`lm-res-${primary.id}`}
              />
            </dd>
          </div>
          <dd className="shrink-0 pb-1 font-mono text-base font-bold">
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
          className={`${retroInsetClass} flex flex-col gap-2 px-3 py-2`}
        >
          <dt className={`${retroLabelClass} truncate`}>{r.label}</dt>
          <dd className={`${pixelClass} text-xs text-amber-100`}>
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
