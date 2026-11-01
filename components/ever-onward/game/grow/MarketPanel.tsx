"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { canPerformAction } from "@/lib/ever-onward/engine/engine";
import {
  CROPS,
  CROP_LABELS,
  bestCrop,
  demandOf,
  plantActionId,
  plantedCrop,
  plantingsSoFar,
  sproutLeft,
  type Crop,
} from "@/lib/ever-onward/universes/grow/market";
import type { PanelProps } from "../../universes/types";
import { pixelClass, retroFocusClass } from "../retro/retroStyles";

/** Where each crop's order sits, as a share of the widest bar. */
const barWidth = (demand: number): number =>
  Math.round(Math.min(1, Math.max(0.2, demand / 1.6)) * 20) * 5;

const BAR_CLASSES: Record<number, string> = {
  20: "w-1/5",
  25: "w-1/4",
  30: "w-[30%]",
  35: "w-[35%]",
  40: "w-2/5",
  45: "w-[45%]",
  50: "w-1/2",
  55: "w-[55%]",
  60: "w-3/5",
  65: "w-[65%]",
  70: "w-[70%]",
  75: "w-3/4",
  80: "w-4/5",
  85: "w-[85%]",
  90: "w-[90%]",
  95: "w-[95%]",
  100: "w-full",
};

const SWATCH: Record<Crop, string> = {
  tomato: "bg-red-500",
  corn: "bg-yellow-300",
  pumpkin: "bg-orange-500",
};

const TOWNS: Record<Crop, string> = {
  tomato: "Tomato Town",
  corn: "Corn Corner",
  pumpkin: "Pumpkin Point",
};

/** The result line: only changes when the crop is planted and when it is up. */
function resultLine(run: PanelProps["run"]): string {
  if (plantingsSoFar(run) === 0) return "";
  const name = CROP_LABELS[plantedCrop(run)];
  return sproutLeft(run) > 0
    ? `${name} are sprouting. They pay a little less until they are up, and nothing is lost.`
    : `${name} are up and growing.`;
}

/**
 * The market: three towns post their orders, and the order that is wanted
 * most pays the most. Pick what to plant. A new crop takes a moment to sprout
 * and nothing is ever lost; the orders drift on their own, so check back.
 */
export default function MarketPanel({ def, run, onAct }: PanelProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [focus, setFocus] = useState<number | null>(null);
  if (run.phase !== 1 || run.complete) return null;

  const planted = plantedCrop(run);
  const best = bestCrop(run);
  const rovingIndex = focus ?? CROPS.indexOf(planted);
  const result = resultLine(run);

  const move = (to: number) => {
    const next = (to + CROPS.length) % CROPS.length;
    setFocus(next);
    refs.current[next]?.focus();
  };

  // Deliberate: arrows only move focus. Planting has a cost (the new crop
  // sprouts for a moment), so it takes Enter, Space or a click to choose.
  const onKeyDown = (e: KeyboardEvent, i: number) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      move(i + 1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      move(i - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      move(0);
    } else if (e.key === "End") {
      e.preventDefault();
      move(CROPS.length - 1);
    }
  };

  return (
    <section
      aria-label="The market"
      data-testid="lm-market"
      data-planted={planted}
      className="space-y-3 border-4 border-orange-300/70 bg-slate-950/85 p-3 shadow-[4px_4px_0_#7c2d12]"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={`${pixelClass} text-[10px] text-orange-200`}>
          Market orders
        </h2>
        <p className={`${pixelClass} text-[8px] text-orange-100/80`}>
          Most wanted: {CROP_LABELS[best]}
        </p>
      </header>
      <p className="text-xs text-lime-50 sm:text-sm">
        The towns are asking for different crops. Plant what is wanted most and
        every harvest pays more.
      </p>
      <div
        role="radiogroup"
        aria-label="What to plant"
        className="grid gap-2 sm:grid-cols-3"
      >
        {CROPS.map((crop, i) => {
          const demand = demandOf(run, crop);
          const checked = crop === planted;
          const doable = canPerformAction(def, run, plantActionId(crop));
          return (
            <button
              key={crop}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={CROP_LABELS[crop]}
              aria-describedby={`lm-market-${crop}-order`}
              tabIndex={i === rovingIndex ? 0 : -1}
              data-testid={`lm-market-${crop}`}
              onFocus={() => setFocus(i)}
              onKeyDown={(e) => onKeyDown(e, i)}
              onClick={() => {
                if (!checked && doable) onAct(plantActionId(crop));
              }}
              className={`${pixelClass} min-h-14 w-full touch-manipulation space-y-1 border-4 p-2 text-left text-[9px] sm:text-[10px] ${retroFocusClass} ${
                checked
                  ? "border-orange-200 bg-orange-400 text-orange-950 shadow-[4px_4px_0_#7c2d12]"
                  : "border-slate-500 bg-slate-800 text-slate-100 shadow-[4px_4px_0_#0f172a] hover:bg-slate-700 active:translate-y-0.5 active:shadow-none"
              }`}
            >
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={`h-3 w-3 shrink-0 ${SWATCH[crop]}`}
                />
                <span>{CROP_LABELS[crop]}</span>
              </span>
              <span aria-hidden="true" className="block h-2 w-full bg-black/40">
                <span
                  className={`block h-2 ${SWATCH[crop]} ${BAR_CLASSES[barWidth(demand)]}`}
                />
              </span>
              <span
                id={`lm-market-${crop}-order`}
                className="block font-mono text-[11px] font-bold normal-case"
              >
                {TOWNS[crop]} pays {Math.round(demand * 100)}%
                {crop === best ? ", most wanted" : ""}
                {checked ? ", in the ground" : ""}
              </span>
            </button>
          );
        })}
      </div>
      <p
        role="status"
        aria-live="polite"
        data-testid="lm-market-result"
        className={
          result
            ? "border-2 border-emerald-400 bg-emerald-950/70 p-2 font-mono text-sm font-bold text-emerald-200"
            : "sr-only"
        }
      >
        {result}
      </p>
    </section>
  );
}
