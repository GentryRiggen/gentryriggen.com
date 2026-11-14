"use client";

import { canPerformAction } from "@/lib/ever-onward/engine/engine";
import {
  LEAF_WORDS,
  MAX_AIM,
  SHADE_ACTION_ID,
  SKY_WORDS,
  SUN_ACTION_ID,
  aimOf,
  aimWords,
  isBlindMoving,
  leafOf,
  needsLook,
  potGrowth,
  potStage,
  skyOf,
  windowBoxLine,
  type LeafMood,
  type PotStage,
  type SkyId,
} from "@/lib/ever-onward/universes/grow/windowbox";
import type { PanelProps } from "../../universes/types";
import PanelFrame from "../retro/PanelFrame";
import { pixelClass, retroFocusClass } from "../retro/retroStyles";

const STAGE_WORDS: Record<PotStage, string> = {
  soil: "Just soil, and a seed that is thinking about it",
  sprout: "A green sprout",
  bud: "A tight little bud",
  bloom: "In bloom",
};

const LEAF_TONE: Record<LeafMood, string> = {
  perky: "text-lime-300",
  curl: "text-amber-300",
  dry: "text-orange-300",
  droop: "text-sky-300",
  soggy: "text-sky-200",
};

const BUTTONS = [
  {
    id: SUN_ACTION_ID,
    label: "More sun",
    up: "Grows faster",
    down: "Dries the soil out",
    icon: "☀",
  },
  {
    id: SHADE_ACTION_ID,
    label: "More shade",
    up: "Keeps the soil moist",
    down: "Grows slower",
    icon: "☁",
  },
] as const;

/**
 * The old window box: one pot, one blind, one quiet choice. More sun grows
 * the pot faster and dries the soil; shade is slow but keeps it moist. The
 * panel never says which is right: the leaves do, and so does the weather
 * outside, which keeps changing. The two choices are plain buttons (stable
 * labels, aria-disabled at the ends of the blind, never remounted).
 */
export default function WindowBox({ def, run, onAct }: PanelProps) {
  if (run.phase !== 3 || run.complete) return null;

  const stage = potStage(run);
  const leaf = leafOf(run);
  const sky = skyOf(run).id as SkyId;
  const aim = aimOf(run);
  const percent = Math.floor(potGrowth(run) * 100);
  const look = needsLook(run);
  const leafHeading = stage === "soil" ? "The soil" : "The leaves";

  return (
    <PanelFrame
      label="The old window box"
      title="The old window box"
      tone="amber"
      status={STAGE_WORDS[stage]}
      statusActive={look}
      testId="eo-windowbox"
      data={{
        "data-stage": stage,
        "data-leaf": leaf,
        "data-sky": sky,
        "data-aim": String(aim),
      }}
      result={windowBoxLine(run)}
      resultTestId="eo-windowbox-result"
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <div
          data-testid="eo-windowbox-leaves"
          className="space-y-1 border-2 border-slate-700 bg-slate-900/80 p-2"
        >
          <p className={`${pixelClass} text-[10px] text-slate-400`}>
            {leafHeading}
          </p>
          <p
            className={`${pixelClass} text-xs leading-relaxed sm:text-sm ${LEAF_TONE[leaf]}`}
          >
            {stage === "soil" ? LEAF_SOIL_WORDS[leaf] : LEAF_WORDS[leaf]}
          </p>
        </div>
        <div
          data-testid="eo-windowbox-sky"
          className="space-y-1 border-2 border-slate-700 bg-slate-900/80 p-2"
        >
          <p className={`${pixelClass} text-[10px] text-slate-400`}>Outside</p>
          <p className={`${pixelClass} text-xs text-lime-50 sm:text-sm`}>
            {SKY_WORDS[sky]}
          </p>
        </div>
      </div>

      <div
        data-testid="eo-windowbox-blind"
        className="space-y-1 border-2 border-slate-700 bg-slate-900/80 p-2"
      >
        <p className="font-mono text-xs text-slate-300">
          The blind: {aimWords(run).toLowerCase()}
          {isBlindMoving(run) ? " (moving, give it a moment)" : ""}
        </p>
        <div
          role="img"
          aria-label={`The blind is ${aim} of ${MAX_AIM} steps open`}
          className="flex gap-1"
        >
          {Array.from({ length: MAX_AIM + 1 }, (_, i) => (
            <span
              key={i}
              aria-hidden="true"
              className={`h-3 flex-1 border-2 ${
                i <= aim
                  ? "border-amber-200 bg-amber-300"
                  : "border-slate-600 bg-slate-800"
              }`}
            />
          ))}
        </div>
      </div>

      <div
        role="group"
        aria-label="Turn the blind"
        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
      >
        {BUTTONS.map((b) => {
          const doable = canPerformAction(def, run, b.id);
          return (
            <button
              key={b.id}
              type="button"
              aria-disabled={!doable}
              aria-label={b.label}
              data-testid={`eo-windowbox-${b.id}`}
              onClick={() => {
                if (doable) onAct(b.id);
              }}
              className={`${pixelClass} min-h-14 w-full touch-manipulation space-y-1 border-4 p-2 text-left text-[10px] ${retroFocusClass} ${
                doable
                  ? "border-amber-200 bg-amber-400 text-amber-950 shadow-[4px_4px_0_#78350f] hover:bg-amber-300 active:translate-y-0.5 active:shadow-none"
                  : "border-slate-600 bg-slate-800 text-slate-400 shadow-[4px_4px_0_#0f172a]"
              }`}
            >
              <span className="block">
                <span aria-hidden="true">{b.icon} </span>
                {b.label}
              </span>
              <span className="block font-mono text-xs font-bold normal-case">
                + {b.up}
              </span>
              <span className="block font-mono text-xs font-bold normal-case">
                − {b.down}
              </span>
            </button>
          );
        })}
      </div>

      <p className="font-mono text-xs text-slate-300">
        The pot is {percent}% grown. The blind takes a few seconds to move.
      </p>
    </PanelFrame>
  );
}

/** Before there are leaves, the soil says the same things. */
const LEAF_SOIL_WORDS: Record<LeafMood, string> = {
  perky: "Dark and just damp",
  curl: "Pale and drying",
  dry: "Dusty and cracked",
  droop: "Wet and heavy",
  soggy: "Soggy, with a puddle",
};
