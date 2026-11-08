"use client";

import { canPerformAction } from "@/lib/ever-onward/engine/engine";
import {
  SNAP_WORDS,
  STRAINS,
  isSkyOpen,
  isStrainSettling,
  strainActionId,
  strainStep,
} from "@/lib/ever-onward/universes/higher/sky";
import type { PanelProps } from "../../universes/types";
import PanelFrame from "../retro/PanelFrame";
import { pixelClass, retroFocusClass } from "../retro/retroStyles";
import useRoving from "../grow/useRoving";

const pct = (n: number): string => `${Math.round(n * 100)}%`;

/**
 * The cable's strain, from slack to humming (the Sky's pace dial). Each card
 * shows what it pays and how often it snaps, and none says which is better:
 * a gust on a tight cable snaps it far more often, so the answer moves with
 * the forecast.
 */
export default function StrainPanel({ def, run, onAct }: PanelProps) {
  const active = strainStep(run);
  const { radioProps } = useRoving(STRAINS.length, active);
  if (!isSkyOpen(run)) return null;
  return (
    <PanelFrame
      label="The cable's strain"
      title="How tight is the cable?"
      icon="/"
      tone="orange"
      status={STRAINS[active].name.toLowerCase()}
      statusActive={active >= 2}
      testId="bh-strain"
      data={{ "data-strain": active }}
    >
      <div
        role="radiogroup"
        aria-label="How tight to pull the cable"
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
        {STRAINS.map((s, i) => {
          const checked = i === active;
          const doable = canPerformAction(def, run, strainActionId(i));
          return (
            <button
              key={s.name}
              {...radioProps(i)}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-disabled={!checked && !doable}
              aria-label={`${s.name} cable`}
              data-testid={`bh-strain-${i}`}
              onClick={() => {
                if (!checked && doable) onAct(strainActionId(i));
              }}
              className={`${pixelClass} min-h-14 w-full touch-manipulation space-y-1.5 border-4 p-2 text-left text-[10px] ${retroFocusClass} ${
                checked
                  ? "border-orange-200 bg-orange-400 text-orange-950 shadow-[4px_4px_0_#7c2d12]"
                  : "border-slate-500 bg-slate-800 text-slate-100 shadow-[4px_4px_0_#0f172a] hover:bg-slate-700 active:translate-y-0.5 active:shadow-none"
              }`}
            >
              <span className="block">{s.name}</span>
              <span className="block font-mono text-xs leading-snug font-bold normal-case tabular-nums">
                <span className="block">
                  {s.pay >= 1 ? "+" : "-"}
                  {pct(Math.abs(s.pay - 1))} beams
                </span>
                <span className="block">{SNAP_WORDS[i]}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="font-mono text-xs text-slate-300">
        {isStrainSettling(run)
          ? "Changing the strain… the cable takes a moment to settle."
          : "Changing the strain takes a moment to settle."}{" "}
        A gust on a tight cable snaps it much more often. A snap loses the load
        and takes a moment to restring. In a strong gust a loose load can drop
        at any strain, and only a tie-down keeps it.
      </p>
    </PanelFrame>
  );
}
