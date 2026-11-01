import { formatNumber } from "@/lib/ever-onward/engine/format";
import type { RunState, UniverseDef } from "@/lib/ever-onward/engine/types";
import AnimatedValue from "./AnimatedValue";
import {
  pixelClass,
  retroInsetClass,
  retroLabelClass,
} from "./retro/retroStyles";

interface ResourcesProps {
  def: UniverseDef;
  run: RunState;
  /** The phase's main currency lives in the HUD, so it is left out here. */
  primaryId: string;
}

function formatResource(id: string, value: number): string {
  if (id === "night") return `${value.toFixed(1)}%`;
  if (id === "oilPrice") return value.toFixed(2);
  // The flame holds 0-1000; the player reads it as a percent.
  if (id === "flame") return `${Math.round(value / 10)}%`;
  return formatNumber(Math.floor(value));
}

export default function Resources({ def, run, primaryId }: ResourcesProps) {
  const phaseId = def.phases[run.phase].id;
  const shown = def.resources.filter(
    (r) => r.phases === undefined || r.phases.includes(phaseId)
  );
  const others = shown.filter((r) => r.id !== primaryId);
  return (
    <dl
      aria-label="Resources"
      className="grid grid-cols-2 gap-2 sm:grid-cols-3"
    >
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
