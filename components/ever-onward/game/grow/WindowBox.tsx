"use client";

import { canPerformAction } from "@/lib/ever-onward/engine/engine";
import {
  WANTS,
  currentWant,
  isWanting,
  potGrowth,
  potStage,
  secondsToWant,
  tendActionId,
  windowBoxLine,
  type PotStage,
} from "@/lib/ever-onward/universes/grow/windowbox";
import type { PanelProps } from "../../universes/types";
import { pixelClass, retroFocusClass } from "../retro/retroStyles";

const STAGE_WORDS: Record<PotStage, string> = {
  soil: "Just soil, and a seed that is thinking about it",
  sprout: "A green sprout",
  bud: "A tight little bud",
  bloom: "In bloom",
};

/** The old window box's pot, drawn in four small steps. */
function Pot({ stage }: { stage: PotStage }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className="h-32 w-32 shrink-0"
      role="img"
      aria-label={`The pot: ${STAGE_WORDS[stage].toLowerCase()}`}
      data-testid="lm-windowbox-pot"
      data-stage={stage}
      shapeRendering="crispEdges"
    >
      <rect x="0" y="0" width="48" height="48" fill="#1e293b" />
      <rect x="4" y="4" width="40" height="40" fill="#fde68a" opacity="0.22" />
      <rect x="2" y="40" width="44" height="6" fill="#78350f" />
      <rect x="12" y="30" width="24" height="12" fill="#c2410c" />
      <rect x="10" y="28" width="28" height="4" fill="#ea580c" />
      <rect x="14" y="28" width="20" height="2" fill="#451a03" />
      {stage !== "soil" && (
        <rect
          x="23"
          y={stage === "sprout" ? 22 : 14}
          width="2"
          height="14"
          fill="#16a34a"
        />
      )}
      {stage === "sprout" && (
        <>
          <rect x="19" y="21" width="5" height="3" fill="#4ade80" />
          <rect x="25" y="19" width="5" height="3" fill="#4ade80" />
        </>
      )}
      {stage === "bud" && (
        <>
          <rect x="20" y="22" width="4" height="3" fill="#4ade80" />
          <rect x="25" y="19" width="4" height="3" fill="#4ade80" />
          <rect x="21" y="10" width="6" height="6" fill="#f472b6" />
        </>
      )}
      {stage === "bloom" && (
        <>
          <rect x="20" y="22" width="4" height="3" fill="#4ade80" />
          <rect x="25" y="19" width="4" height="3" fill="#4ade80" />
          <rect x="17" y="6" width="14" height="14" fill="#fb7185" />
          <rect x="14" y="9" width="20" height="8" fill="#fda4af" />
          <rect x="21" y="10" width="6" height="6" fill="#fde047" />
        </>
      )}
    </svg>
  );
}

/**
 * The old window box: one small pot on one small sill. Now and then the pot
 * seems to want something, and the words say what. Every answer helps, the
 * right one most. The three choices are plain buttons (stable labels,
 * aria-disabled while the pot rests, never remounted).
 */
export default function WindowBox({ def, run, onAct }: PanelProps) {
  if (run.phase !== 3 || run.complete) return null;

  const stage = potStage(run);
  const wanting = isWanting(run);
  const want = currentWant(run);
  const percent = Math.floor(potGrowth(run) * 100);
  const headline = wanting
    ? "The pot wants something. What would be kind?"
    : `The pot is resting. It will ask again in about ${Math.max(1, Math.ceil(secondsToWant(run)))} seconds.`;

  return (
    <section
      aria-label="The old window box"
      data-testid="lm-windowbox"
      data-stage={stage}
      data-wanting={wanting ? "true" : "false"}
      className="space-y-3 border-4 border-amber-300/70 bg-slate-950/85 p-3 shadow-[4px_4px_0_#78350f]"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={`${pixelClass} text-[10px] text-amber-200`}>
          The old window box
        </h2>
        <p
          className={`${pixelClass} border-2 px-2 py-1 text-[8px] ${
            wanting
              ? "border-amber-300 bg-amber-950 text-amber-100"
              : "border-slate-600 bg-slate-900 text-slate-300"
          }`}
        >
          {STAGE_WORDS[stage]}
        </p>
      </header>

      <div className="flex items-center gap-3">
        <Pot stage={stage} />
        <div className="min-w-0 flex-1 space-y-2">
          <p
            data-testid="lm-windowbox-headline"
            className={`${pixelClass} text-xs leading-relaxed sm:text-sm ${
              wanting ? "text-amber-300" : "text-lime-50"
            }`}
          >
            {headline}
          </p>
          <p className="font-mono text-xs text-slate-300">
            The pot is {percent}% grown. Every answer helps. The right one helps
            most.
          </p>
        </div>
      </div>

      <div
        role="group"
        aria-label="Tend the pot"
        className="grid grid-cols-1 gap-2 sm:grid-cols-3"
      >
        {WANTS.map((w, i) => {
          const doable = canPerformAction(def, run, tendActionId(i));
          const right = wanting && want === i;
          return (
            <button
              key={w.id}
              type="button"
              aria-disabled={!doable}
              aria-label={w.label}
              aria-describedby={`lm-windowbox-${w.id}-note`}
              data-testid={`lm-windowbox-${w.id}`}
              onClick={() => {
                if (doable) onAct(tendActionId(i));
              }}
              className={`${pixelClass} min-h-14 w-full touch-manipulation space-y-1 border-4 p-2 text-left text-[9px] sm:text-[10px] ${retroFocusClass} ${
                doable
                  ? "border-amber-200 bg-amber-400 text-amber-950 shadow-[4px_4px_0_#78350f] hover:bg-amber-300 active:translate-y-0.5 active:shadow-none"
                  : "border-slate-600 bg-slate-800 text-slate-400 shadow-[4px_4px_0_#0f172a]"
              }`}
            >
              <span className="block">{w.label}</span>
              <span
                id={`lm-windowbox-${w.id}-note`}
                className="block font-mono text-[11px] font-bold normal-case"
              >
                {doable
                  ? right
                    ? "Just what it wanted"
                    : "It will like this too"
                  : "The pot is resting"}
              </span>
            </button>
          );
        })}
      </div>

      <p
        role="status"
        aria-live="polite"
        data-testid="lm-windowbox-result"
        className="border-2 border-amber-400 bg-amber-950/70 p-2 font-mono text-sm font-bold text-amber-200"
      >
        {windowBoxLine(run)}
      </p>
    </section>
  );
}
