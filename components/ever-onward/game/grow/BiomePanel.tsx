"use client";

import { canPerformAction } from "@/lib/ever-onward/engine/engine";
import {
  BIOMES,
  BIOME_LABELS,
  PERK_WORDS,
  activeBiome,
  bestBiome,
  biomeShare,
  spreadActionId,
  switchesSoFar,
  worldCover,
} from "@/lib/ever-onward/universes/grow/biomes";
import type { PanelProps } from "../../universes/types";
import { pixelClass, retroFocusClass } from "../retro/retroStyles";
import useRoving from "./useRoving";

const SWATCH = {
  forest: "bg-emerald-600",
  jungle: "bg-lime-400",
  meadow: "bg-yellow-300",
  wetland: "bg-sky-400",
} as const;

const pct = (n: number): string => `${Math.round(n * 100)}%`;

/** The result line: only changes when a different biome is chosen. */
function resultLine(run: PanelProps["run"]): string {
  const name = BIOME_LABELS[activeBiome(run)];
  return switchesSoFar(run) === 0
    ? `${name} is spreading.`
    : `${name} is spreading. A new place takes a moment to settle, and nothing is lost.`;
}

/**
 * The biomes: pick what the planters and the birds spread next. Each one
 * helps in its own way, and a mix beats piling into one. Switching never
 * costs anything. A real radio group (arrow keys, one tab stop).
 */
export default function BiomePanel({ def, run, onAct }: PanelProps) {
  const active = BIOMES.indexOf(activeBiome(run));
  const { radioProps } = useRoving(BIOMES.length, active);
  if (run.phase !== 2 || run.complete) return null;

  const best = bestBiome(run);

  return (
    <section
      aria-label="What to spread"
      data-testid="lm-biomes"
      data-active={activeBiome(run)}
      className="space-y-3 border-4 border-emerald-300/70 bg-slate-950/85 p-3 shadow-[4px_4px_0_#065f46]"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={`${pixelClass} text-[10px] text-emerald-200`}>
          What to spread
        </h2>
        <p className={`${pixelClass} text-[8px] text-emerald-100/80`}>
          The world is {pct(worldCover(run))} green
        </p>
      </header>
      <div
        role="radiogroup"
        aria-label="Which kind of green to spread"
        className="grid gap-2 sm:grid-cols-2"
      >
        {BIOMES.map((biome, i) => {
          const checked = i === active;
          const doable = canPerformAction(def, run, spreadActionId(biome));
          return (
            <button
              key={biome}
              {...radioProps(i)}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-disabled={!checked && !doable}
              aria-label={BIOME_LABELS[biome]}
              aria-describedby={`lm-biomes-${biome}-note`}
              data-testid={`lm-biomes-${biome}`}
              onClick={() => {
                if (!checked && doable) onAct(spreadActionId(biome));
              }}
              className={`${pixelClass} min-h-14 w-full touch-manipulation space-y-1 border-4 p-2 text-left text-[9px] sm:text-[10px] ${retroFocusClass} ${
                checked
                  ? "border-emerald-200 bg-emerald-400 text-emerald-950 shadow-[4px_4px_0_#065f46]"
                  : "border-slate-500 bg-slate-800 text-slate-100 shadow-[4px_4px_0_#0f172a] hover:bg-slate-700 active:translate-y-0.5 active:shadow-none"
              }`}
            >
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={`h-3 w-3 shrink-0 ${SWATCH[biome]}`}
                />
                <span>{BIOME_LABELS[biome]}</span>
              </span>
              <span
                id={`lm-biomes-${biome}-note`}
                className="block font-mono text-[11px] font-bold normal-case"
              >
                {pct(biomeShare(run, biome))} of the world: {PERK_WORDS[biome]}
                {biome === best && !checked ? ". Worth spreading" : ""}
                {checked ? ". Spreading now" : ""}
              </span>
            </button>
          );
        })}
      </div>
      <p
        role="status"
        aria-live="polite"
        data-testid="lm-biomes-result"
        className="border-2 border-emerald-400 bg-emerald-950/70 p-2 font-mono text-sm font-bold text-emerald-200"
      >
        {resultLine(run)}
      </p>
    </section>
  );
}
