"use client";

import { canPerformAction } from "@/lib/ever-onward/engine/engine";
import { formatNumber } from "@/lib/ever-onward/engine/format";
import type { RunState, UniverseDef } from "@/lib/ever-onward/engine/types";
import {
  GARDEN_PLANTS,
  PICK_ACTION,
  WATER_ACTION,
  bloomCount,
  pickWorthShown,
  gardenResultLine,
  growingCount,
  hasRainBarrel,
  isGardenOpen,
  isPlanted,
  isWet,
  picksSoFar,
  plantedCount,
  progressOf,
  stageOf,
  waterCooldownLeft,
  type PlantStage,
} from "@/lib/ever-onward/universes/light/garden";
import { resolvePerSecond } from "@/lib/ever-onward/universes/light/tick";
import { TUNING } from "@/lib/ever-onward/universes/light/tuning";
import { pixelClass, retroFocusClass } from "./retro/retroStyles";

interface MemoryGardenProps {
  def: UniverseDef;
  run: RunState;
  onAct: (id: string) => void;
}

const STAGE_WORD: Record<PlantStage | "seed", string> = {
  seed: "Just planted",
  sprout: "Sprouting",
  bud: "Budding",
  bloom: "In bloom!",
};

const PETAL_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315] as const;

interface PlantProps {
  stage: PlantStage | "seed";
  petal: string;
  heart: string;
  isDamp: boolean;
}

/** One plot of the bed: soil, and a small pixel plant at its stage. */
function Plant({ stage, petal, heart, isDamp }: PlantProps) {
  const stemTop = stage === "bloom" ? 26 : stage === "bud" ? 32 : 46;
  return (
    <svg
      viewBox="0 0 64 72"
      className="h-16 w-full"
      aria-hidden="true"
      shapeRendering="crispEdges"
    >
      <rect x="6" y="58" width="52" height="10" fill="#4a2f17" />
      <rect x="6" y="58" width="52" height="3" fill="#7c4f2a" />
      <rect x="14" y="63" width="3" height="2" fill="#2f1d0e" />
      <rect x="44" y="64" width="3" height="2" fill="#2f1d0e" />
      {stage === "seed" ? (
        <g>
          <rect x="29" y="55" width="6" height="4" fill="#2f1d0e" />
          <rect x="30" y="55" width="4" height="1" fill="#a16207" />
        </g>
      ) : (
        <g className="gd-sway">
          {stage === "bloom" && (
            <circle
              cx="32"
              cy="22"
              r="18"
              fill={petal}
              className="gd-glow"
              opacity="0.28"
            />
          )}
          <rect
            x="31"
            y={stemTop}
            width="2"
            height={58 - stemTop}
            fill="#22c55e"
          />
          <rect x="23" y="48" width="8" height="4" fill="#4ade80" />
          <rect x="33" y="42" width="8" height="4" fill="#4ade80" />
          {stage === "bud" && (
            <g>
              <rect x="27" y="22" width="10" height="12" fill={petal} />
              <rect x="29" y="19" width="6" height="3" fill={petal} />
              <rect x="25" y="30" width="14" height="4" fill="#16a34a" />
            </g>
          )}
          {stage === "bloom" && (
            <g transform="translate(32 22)">
              {PETAL_ANGLES.map((angle) => (
                <g key={angle} transform={`rotate(${angle})`}>
                  <rect x="-3" y="-11" width="6" height="7" fill={petal} />
                </g>
              ))}
              <rect x="-4" y="-4" width="8" height="8" fill={heart} />
              <rect x="-1" y="-1" width="2" height="2" fill={petal} />
            </g>
          )}
        </g>
      )}
      {isDamp && (
        <g>
          <rect
            x="18"
            y="30"
            width="2"
            height="4"
            fill="#7dd3fc"
            className="gd-drip"
          />
          <rect
            x="44"
            y="26"
            width="2"
            height="4"
            fill="#7dd3fc"
            className="gd-drip [animation-delay:-0.7s]"
          />
          <rect
            x="31"
            y="14"
            width="2"
            height="4"
            fill="#bae6fd"
            className="gd-drip [animation-delay:-1.3s]"
          />
        </g>
      )}
    </svg>
  );
}

const COOL_SEGMENTS = 10;

/** A calm bar that fills as the can fills again; no numbers, no hurry. */
function CanBar({ share }: { share: number }) {
  const filled = Math.round(share * COOL_SEGMENTS);
  return (
    <div
      role="progressbar"
      aria-label="Watering can"
      aria-valuemin={0}
      aria-valuemax={COOL_SEGMENTS}
      aria-valuenow={filled}
      aria-valuetext={filled >= COOL_SEGMENTS ? "ready" : "filling up"}
      data-testid="lm-garden-can"
      data-ready={filled >= COOL_SEGMENTS ? "yes" : "no"}
      className="flex h-3 gap-0.5 border-2 border-slate-600 bg-slate-950 p-0.5"
    >
      {Array.from({ length: COOL_SEGMENTS }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`h-full flex-1 ${i < filled ? "bg-sky-300/80" : "bg-slate-800"}`}
        />
      ))}
    </div>
  );
}

const GROWTH_SEGMENTS = 5;

function GrowthTicks({ progress }: { progress: number }) {
  const filled = Math.floor(progress * GROWTH_SEGMENTS);
  return (
    <div aria-hidden="true" className="flex h-1.5 w-full gap-0.5">
      {Array.from({ length: GROWTH_SEGMENTS }, (_, i) => (
        <span
          key={i}
          className={`h-full flex-1 ${i < filled || progress >= 1 ? "bg-emerald-400/80" : "bg-slate-700"}`}
        />
      ))}
    </div>
  );
}

/**
 * The Memory Garden: every light you let go leaves a seed, and the seeds grow
 * by themselves. Water makes them grow quicker; bloomed flowers wait as long as
 * it takes, and picking one pays a little resolve and warms the lantern.
 * Nothing wilts, and skipping the water costs nothing but time.
 */
export default function MemoryGarden({ def, run, onAct }: MemoryGardenProps) {
  if (!isGardenOpen(run) || run.complete) return null;

  const blooms = bloomCount(run);
  const growing = growingCount(run);
  const wait = waterCooldownLeft(run);
  const isCanReady = wait <= 0;
  const canWater = canPerformAction(def, run, WATER_ACTION);
  const canPick = canPerformAction(def, run, PICK_ACTION);
  const planted = plantedCount(run);
  const picked = picksSoFar(run);
  const earned = run.resources.gdEarned ?? 0;
  const resultLine = gardenResultLine(run);
  const pickWorth = pickWorthShown(blooms, resolvePerSecond(run));
  const actionCount = (run.resources.gdWaterings ?? 0) + picked;

  const headline =
    blooms > 0
      ? blooms === 1
        ? "A flower is ready to pick."
        : `${blooms} flowers are ready to pick.`
      : growing > 0
        ? "The seeds are growing."
        : "Everything is in bloom.";
  const hint =
    blooms > 0
      ? "Flowers wait for you. They never wilt."
      : "Water helps them grow, but they grow without it too.";
  const waterNote =
    growing === 0
      ? "Nothing is thirsty"
      : isCanReady
        ? "Thirsty plants grow faster"
        : "The can is filling…";

  return (
    <section
      aria-label="Memory garden"
      data-testid="lm-garden-panel"
      data-blooms={blooms}
      className="relative isolate space-y-3 overflow-hidden border-4 border-emerald-400/80 bg-slate-950/85 p-3 shadow-[4px_4px_0_#064e3b]"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={`${pixelClass} text-[10px] text-emerald-200`}>
          <span aria-hidden="true" className="mr-2 text-emerald-300">
            ✿
          </span>
          Memory garden
        </h2>
        <p
          className={`${pixelClass} border-2 border-emerald-300/70 bg-emerald-950 px-2 py-1 text-[8px] text-emerald-100`}
        >
          {planted} {planted === 1 ? "flower" : "flowers"}
        </p>
      </header>

      <p
        data-testid="lm-garden-headline"
        className={`${pixelClass} text-xs sm:text-sm ${
          blooms > 0 ? "text-amber-200" : "text-emerald-50"
        }`}
      >
        {headline}
      </p>

      <ul
        aria-label="Flower beds"
        className="grid grid-cols-4 gap-1.5 border-2 border-emerald-900 bg-[#0b1a14] p-1.5"
      >
        {GARDEN_PLANTS.map((plant, plot) => {
          if (!isPlanted(run, plot)) return null;
          const progress = progressOf(run, plot);
          const stage = stageOf(run, plot);
          const shown =
            stage === "sprout" && progress < TUNING.garden.sproutAt
              ? "seed"
              : stage;
          return (
            <li
              key={plant.id}
              aria-label={`${plant.name}: ${STAGE_WORD[shown].toLowerCase()}`}
              data-testid="lm-garden-plot"
              data-stage={shown}
              className="flex min-w-0 flex-col items-center gap-1"
            >
              <Plant
                stage={shown}
                petal={plant.petal}
                heart={plant.heart}
                isDamp={isWet(run, plot)}
              />
              <GrowthTicks progress={progress} />
              <span className="w-full text-center font-mono text-[10px] font-bold leading-tight text-emerald-50">
                {plant.name}
              </span>
              <span
                aria-hidden="true"
                className={`font-mono text-[10px] leading-none ${
                  shown === "bloom" ? "text-amber-300" : "text-slate-300"
                }`}
              >
                {STAGE_WORD[shown]}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="space-y-2">
        <button
          type="button"
          data-testid="lm-garden-water"
          aria-disabled={!canWater}
          onClick={() => {
            if (canWater) onAct(WATER_ACTION);
          }}
          className={`${pixelClass} flex min-h-14 w-full touch-manipulation flex-col items-center justify-center gap-1 border-4 px-3 py-2 text-xs transition-transform ${retroFocusClass} ${
            canWater
              ? "border-sky-200 bg-sky-400 text-sky-950 shadow-[4px_4px_0_#0c4a6e] hover:bg-sky-300 active:translate-y-0.5 active:shadow-none"
              : "cursor-default border-slate-600 bg-slate-800 text-slate-300 shadow-[4px_4px_0_#0f172a]"
          }`}
        >
          <span>Water the garden</span>
          <span className="font-mono text-[11px] font-bold normal-case">
            {waterNote}
          </span>
        </button>
        <CanBar
          share={growing === 0 ? 1 : 1 - wait / TUNING.garden.waterCooldown}
        />
        <button
          type="button"
          data-testid="lm-garden-pick"
          aria-disabled={!canPick}
          onClick={() => {
            if (canPick) onAct(PICK_ACTION);
          }}
          className={`${pixelClass} flex min-h-14 w-full touch-manipulation flex-col items-center justify-center gap-1 border-4 px-3 py-2 text-xs transition-transform ${retroFocusClass} ${
            canPick
              ? "border-amber-200 bg-amber-400 text-amber-950 shadow-[4px_4px_0_#78350f,0_0_18px_rgba(251,191,36,0.7)] hover:bg-amber-300 active:translate-y-0.5 active:shadow-none"
              : "cursor-default border-slate-600 bg-slate-800 text-slate-300 shadow-[4px_4px_0_#0f172a]"
          }`}
        >
          <span>Pick the blooms</span>
          <span className="font-mono text-[11px] font-bold normal-case">
            {canPick
              ? `about +${formatNumber(pickWorth)} resolve`
              : "No blooms yet"}
          </span>
        </button>
      </div>

      <div role="status" aria-live="polite">
        {resultLine && (
          <p
            key={actionCount}
            data-testid="lm-garden-result"
            className="border-2 border-emerald-400 bg-emerald-950/70 p-2 font-mono text-sm font-bold text-emerald-200"
          >
            {resultLine}
          </p>
        )}
      </div>

      <p className="font-mono text-xs text-slate-300">{hint}</p>
      {hasRainBarrel(run) && (
        <p className="font-mono text-xs text-sky-100">
          The rain barrel waters the thirsty ones now and then, on top of you.
        </p>
      )}
      {picked > 0 && (
        <p
          data-testid="lm-garden-tally"
          className="font-mono text-xs text-slate-300"
        >
          Memory flowers picked: {picked} (+{formatNumber(Math.round(earned))}{" "}
          resolve).
        </p>
      )}
    </section>
  );
}
