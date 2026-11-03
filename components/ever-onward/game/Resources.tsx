import {
  formatResourceValue,
  shownResources,
} from "@/lib/ever-onward/engine/changes";
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
  /** Resources shown elsewhere (e.g. by the countdown bar), left out here. */
  hiddenIds?: readonly string[];
}

export default function Resources({
  def,
  run,
  primaryId,
  hiddenIds = [],
}: ResourcesProps) {
  const others = shownResources(def, run).filter(
    (r) => r.id !== primaryId && !hiddenIds.includes(r.id)
  );
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
          <dt className={`${retroLabelClass} break-words leading-snug!`}>
            {r.label}
          </dt>
          <dd className={`${pixelClass} text-xs text-amber-100`}>
            <AnimatedValue
              value={run.resources[r.id] ?? 0}
              format={(v) => formatResourceValue(r, v)}
              testId={`lm-res-${r.id}`}
            />
          </dd>
          {r.purpose && (
            <dd className="font-mono text-xs leading-snug text-slate-300">
              {r.purpose}
            </dd>
          )}
        </div>
      ))}
    </dl>
  );
}
