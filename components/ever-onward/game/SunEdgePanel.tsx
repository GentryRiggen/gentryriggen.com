"use client";

import { memo } from "react";
import { canPerformAction } from "@/lib/ever-onward/engine/engine";
import { isDialsOpen } from "@/lib/ever-onward/universes/light/design";
import {
  DISTANCES,
  SIZE_NAMES,
  distanceActionId,
  distanceNow,
  distanceTarget,
  forecastSize,
  isGliding,
  lastBurn,
  moodName,
  sunMood,
  secondsToFlare,
  flaresSoFar,
} from "@/lib/ever-onward/universes/light/sunEdge";
import { TUNING } from "@/lib/ever-onward/universes/light/tuning";
import type { PanelProps } from "../universes/types";
import useRoving from "./grow/useRoving";
import PanelFrame from "./retro/PanelFrame";
import { pixelClass, retroFocusClass } from "./retro/retroStyles";

const D = TUNING.dials;
const STEPS = DISTANCES.length;
/** Segments in a bar: a bar is as long as the real thing is, out of the most any step has. */
const SEGMENTS = 10;

/** Glow segments for how much light a step gathers, as long as the light really is. */
const lightBars = (step: number): number =>
  Math.max(1, Math.round((D.light[step] / Math.max(...D.light)) * SEGMENTS));

/** The most heat any step has under any mood (the longest flame bar). */
const MOST_HEAT =
  Math.max(...D.heat) * Math.max(...D.moods.map((m) => m.reach)) +
  Math.max(...D.moods.map((m) => m.stray));

/** Flame segments for how hot a step is under the sun's mood now, as long as the heat really is. */
const heatBars = (step: number, mood: number): number =>
  Math.round(
    ((D.heat[step] * D.moods[mood].reach + D.moods[mood].stray) / MOST_HEAT) *
      SEGMENTS
  );

const pct = (n: number): string => `${Math.round(n * 100)}%`;

/**
 * The sun's edge: how close the fleet flies. Every card shows the plus (glow
 * bars: how much light it gathers) and the minus (flame bars: how hard a
 * flare reaches it), as a look, never a number to work out. The sun's mood
 * and the flare forecast sit above: the mood is plain, the forecast is
 * vague, so reading them is the game. The fleet glides between steps slowly.
 */
function SunEdgePanel({ def, run, onAct }: PanelProps) {
  const active = distanceTarget(run);
  const { radioProps } = useRoving(STEPS, active);
  if (!isDialsOpen(run) || run.complete) return null;

  const fore = forecastSize(run);
  const seconds = Math.max(5, Math.round(secondsToFlare(run) / 5) * 5);
  const gliding = isGliding(run);
  const where = distanceNow(run);
  const flares = flaresSoFar(run);
  const mood = sunMood(run);

  return (
    <PanelFrame
      label="The sun's edge"
      title="The Sun's Edge"
      icon="☀"
      tone="orange"
      status={DISTANCES[active].label}
      statusActive={false}
      testId="lm-sunedge"
      data={{ "data-step": active }}
    >
      <p className="flex items-baseline justify-between gap-2 font-mono text-sm font-bold">
        <span className="text-slate-300">The sun is</span>
        <span data-testid="lm-sun-mood" className="text-orange-200">
          {moodName(run)}
        </span>
      </p>
      <p
        data-testid="lm-sun-forecast"
        data-size={fore ?? ""}
        className={`border-2 p-2 font-mono text-xs leading-snug ${
          fore === null
            ? "border-slate-600 bg-slate-900/80 text-slate-300"
            : "border-red-400 bg-red-950/70 text-red-100"
        }`}
      >
        {fore === null
          ? flares > 0
            ? `No flare in sight. The last one burned ${pct(lastBurn(run))} of the fleet.`
            : "No flare in sight yet."
          : `A flare is coming in about ${seconds} s. It looks ${SIZE_NAMES[fore]}, but the forecast is not always right.`}
      </p>
      <div
        role="radiogroup"
        aria-label="How close to the sun"
        className="grid grid-cols-5 gap-1.5"
      >
        {DISTANCES.map((step, i) => {
          const checked = i === active;
          const doable = canPerformAction(def, run, distanceActionId(i));
          return (
            <button
              key={step.label}
              {...radioProps(i)}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-disabled={!checked && !doable}
              aria-label={`${step.label}: ${lightBars(i)} of ${SEGMENTS} for light, ${heatBars(i, mood)} of ${SEGMENTS} for flare heat`}
              data-testid={`lm-sunedge-${i}`}
              onClick={() => {
                if (!checked && doable) onAct(distanceActionId(i));
              }}
              className={`${pixelClass} min-h-20 w-full touch-manipulation space-y-1 border-4 p-1.5 text-left text-[10px] ${retroFocusClass} ${
                checked
                  ? "border-orange-100 bg-orange-300 text-orange-950 shadow-[3px_3px_0_#7c2d12]"
                  : "border-slate-500 bg-slate-800 text-slate-100 shadow-[3px_3px_0_#0f172a] hover:bg-slate-700 active:translate-y-0.5 active:shadow-none aria-disabled:opacity-60"
              }`}
            >
              <span className="block">{step.label}</span>
              <span className="flex gap-0.5" aria-hidden="true">
                {Array.from({ length: SEGMENTS }, (_, bar) => (
                  <span
                    key={bar}
                    className={`h-2 flex-1 ${bar < lightBars(i) ? "bg-yellow-300" : "bg-slate-600/50"}`}
                  />
                ))}
              </span>
              <span className="flex gap-0.5" aria-hidden="true">
                {Array.from({ length: SEGMENTS }, (_, bar) => (
                  <span
                    key={bar}
                    className={`h-2 flex-1 ${bar < heatBars(i, mood) ? "bg-red-500" : "bg-slate-600/50"}`}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <p className="flex gap-3 font-mono text-xs text-slate-300">
        <span>
          <span className="text-yellow-300">▮</span> light
        </span>
        <span>
          <span className="text-red-500">▮</span> flare heat
        </span>
      </p>
      <p
        data-testid="lm-sunedge-glide"
        className="font-mono text-xs text-slate-300"
      >
        {gliding
          ? `The fleet is flying ${where < active ? "in" : "out"}, about ${D.distanceStepSeconds} s a step.`
          : `The fleet takes about ${D.distanceStepSeconds} s to move a step.`}
      </p>
    </PanelFrame>
  );
}

export default memo(SunEdgePanel);
