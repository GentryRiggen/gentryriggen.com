"use client";

import { canPerformAction } from "@/lib/ever-onward/engine/engine";
import {
  BIOMES,
  BIOME_LABELS,
  MAX_POINTS,
  PERK_WORDS,
  biomeShare,
  blightOf,
  blightedBiome,
  isBiomeLocked,
  lessActionId,
  moreActionId,
  pointsOf,
  targetShare,
  worldCover,
  type Biome,
} from "@/lib/ever-onward/universes/grow/biomes";
import { TUNING } from "@/lib/ever-onward/universes/grow/tuning";
import {
  isDry,
  rainOutlook,
  waterLevel,
} from "@/lib/ever-onward/universes/grow/water";
import type { PanelProps } from "../../universes/types";
import PanelFrame from "../retro/PanelFrame";
import { pixelClass, retroFocusClass } from "../retro/retroStyles";

const SWATCH = {
  forest: "bg-emerald-600",
  jungle: "bg-lime-400",
  meadow: "bg-yellow-300",
  wetland: "bg-sky-400",
} as const;

/** Full class names so Tailwind sees them: a share bar's colour by biome. */
const BAR = {
  forest:
    "[&::-webkit-progress-value]:bg-emerald-500 [&::-moz-progress-bar]:bg-emerald-500",
  jungle:
    "[&::-webkit-progress-value]:bg-lime-400 [&::-moz-progress-bar]:bg-lime-400",
  meadow:
    "[&::-webkit-progress-value]:bg-yellow-300 [&::-moz-progress-bar]:bg-yellow-300",
  wetland:
    "[&::-webkit-progress-value]:bg-sky-400 [&::-moz-progress-bar]:bg-sky-400",
} as const;
const ROT_BAR =
  "[&::-webkit-progress-value]:bg-stone-500 [&::-moz-progress-bar]:bg-stone-500";
const WATER_BAR = (low: boolean) =>
  low
    ? "[&::-webkit-progress-value]:bg-red-400 [&::-moz-progress-bar]:bg-red-400"
    : "[&::-webkit-progress-value]:bg-sky-400 [&::-moz-progress-bar]:bg-sky-400";

const pct = (n: number): string => `${Math.round(n * 100)}%`;

/** Rain, in plain words (the world's weather drifts like the oil price). */
function rainWords(outlook: number): string {
  if (outlook < 0.3) return "a dry spell";
  if (outlook < 0.6) return "some showers";
  return "a rainy spell";
}

/** The result line: the mix as it stands, or the blight in it. */
function resultLine(run: PanelProps["run"]): string {
  const sick = blightedBiome(run);
  if (sick)
    return `Blight in the ${BIOME_LABELS[sick].toLowerCase()}: it covers too much of the world. Spread the mix out to cure it.`;
  if (isDry(run))
    return "The world has run dry. The thirsty green is drying out.";
  return "Slide each kind up or down. The land moves toward the mix a little at a time.";
}

const stepButton = (isOn: boolean) =>
  `${pixelClass} flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center border-4 text-base leading-none aria-disabled:cursor-not-allowed ${retroFocusClass} ${
    isOn
      ? "border-emerald-200 bg-emerald-500 text-emerald-950 shadow-[3px_3px_0_#065f46] hover:bg-emerald-400 active:translate-y-0.5 active:shadow-none"
      : "border-slate-600 bg-slate-800 text-slate-500 shadow-[3px_3px_0_#0f172a]"
  }`;

/**
 * The world's mix: a slider for each kind of green says how much of the
 * planet it should be. Each one helps in its own way and costs in its own
 * way, the land moves toward the mix over time, and a kind that covers too
 * much rots. The water tank sits on top, since the jungle drinks it dry.
 */
export default function BiomePanel({ def, run, onAct }: PanelProps) {
  if (run.phase !== 2 || run.complete) return null;
  const level = waterLevel(run);
  const outlook = rainOutlook(run);
  const act = (id: string) => {
    if (canPerformAction(def, run, id)) onAct(id);
  };

  return (
    <PanelFrame
      label="The mix"
      title="The mix"
      tone="emerald"
      status={`The world is ${pct(worldCover(run))} green`}
      statusActive={false}
      testId="lm-biomes"
      data={{ "data-blight": blightedBiome(run) ?? "none" }}
      result={resultLine(run)}
      resultTone={blightedBiome(run) ? "amber" : "emerald"}
      resultTestId="lm-biomes-result"
    >
      <div className="mb-2 space-y-1 font-mono text-xs font-bold normal-case text-sky-100">
        <div className="flex items-center justify-between gap-2">
          <span>Water in the tank: {pct(level)}</span>
          <span>Rain: {rainWords(outlook)}</span>
        </div>
        <progress
          max={100}
          value={Math.round(level * 100)}
          aria-label="Water in the tank"
          className={`block h-2 w-full appearance-none border-0 bg-slate-700 [&::-webkit-progress-bar]:bg-slate-700 ${WATER_BAR(level < 0.3)}`}
        />
      </div>
      <p className="mb-2 font-mono text-xs font-bold normal-case text-stone-300">
        A kind that covers more than {pct(TUNING.world.blightAt)} of the world
        catches a blight, and pays much less until the mix is spread out again.
      </p>
      <ul className="grid gap-2 sm:grid-cols-2" aria-label="The mix sliders">
        {BIOMES.map((biome: Biome) => {
          const locked = isBiomeLocked(run, biome);
          const rot = blightOf(run, biome);
          const sick = rot >= TUNING.world.blightShows;
          const points = pointsOf(run, biome);
          const canMore = canPerformAction(def, run, moreActionId(biome));
          const canLess = canPerformAction(def, run, lessActionId(biome));
          return (
            <li
              key={biome}
              data-testid={`lm-biomes-${biome}`}
              data-points={points}
              data-sick={sick}
              className={`${pixelClass} space-y-1 border-4 p-2 text-[10px] ${
                sick
                  ? "border-stone-400 bg-stone-800 text-stone-100"
                  : "border-slate-500 bg-slate-800 text-slate-100"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={`h-3 w-3 shrink-0 ${SWATCH[biome]}`}
                />
                <span>{BIOME_LABELS[biome]}</span>
                {sick && (
                  <span className="ml-auto bg-stone-500 px-1 text-stone-950">
                    BLIGHT
                  </span>
                )}
                {locked && <span className="ml-auto">Closed</span>}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-disabled={!canLess}
                  aria-label={`Less ${BIOME_LABELS[biome].toLowerCase()}`}
                  data-testid={`lm-mix-less-${biome}`}
                  onClick={() => act(lessActionId(biome))}
                  className={stepButton(canLess)}
                >
                  -
                </button>
                <div className="min-w-0 flex-1 space-y-1">
                  <div
                    role="img"
                    aria-label={`${points} of ${MAX_POINTS} points`}
                    className="flex gap-0.5"
                  >
                    {Array.from({ length: MAX_POINTS }, (_, i) => (
                      <span
                        key={i}
                        className={`h-3 flex-1 ${
                          i < points ? SWATCH[biome] : "bg-slate-700"
                        }`}
                      />
                    ))}
                  </div>
                  <progress
                    max={100}
                    value={Math.round(biomeShare(run, biome) * 100)}
                    aria-label={`${BIOME_LABELS[biome]} covers`}
                    className={`block h-2 w-full appearance-none border-0 bg-slate-700 [&::-webkit-progress-bar]:bg-slate-700 ${sick ? ROT_BAR : BAR[biome]}`}
                  />
                </div>
                <button
                  type="button"
                  aria-disabled={!canMore}
                  aria-label={`More ${BIOME_LABELS[biome].toLowerCase()}`}
                  data-testid={`lm-mix-more-${biome}`}
                  onClick={() => act(moreActionId(biome))}
                  className={stepButton(canMore)}
                >
                  +
                </button>
              </div>
              <p className="font-mono text-xs font-bold normal-case">
                Covers {pct(biomeShare(run, biome))}, asks for{" "}
                {pct(targetShare(run, biome))}. {PERK_WORDS[biome]}.
                {locked ? " Closed by your choice." : ""}
              </p>
            </li>
          );
        })}
      </ul>
    </PanelFrame>
  );
}
