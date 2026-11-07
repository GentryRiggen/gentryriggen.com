"use client";

import { canPerformAction } from "@/lib/ever-onward/engine/engine";
import {
  CROP_LABELS,
  FIELD_CROPS,
  daySeconds,
  dayResultLine,
  forecastOf,
  forecastStage,
  forecastText,
  grownIfPlantedIn,
  harvestDays,
  isFieldPlanted,
  plantActionId,
  plantedCrop,
  secondsToHarvest,
  soilOf,
  wearsSoil,
  type FieldCrop,
} from "@/lib/ever-onward/universes/grow/market";
import { TUNING } from "@/lib/ever-onward/universes/grow/tuning";
import type { PanelProps } from "../../universes/types";
import PanelFrame from "../retro/PanelFrame";
import { pixelClass, retroFocusClass } from "../retro/retroStyles";
import useRoving from "./useRoving";

const clock = (seconds: number): string => {
  const whole = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

/** Where a forecast sits, as a share of the widest bar (5% steps). */
const barWidth = (demand: number): number =>
  Math.round(Math.min(1, Math.max(0.2, demand / 1.8)) * 20) * 5;

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

const SWATCH: Record<FieldCrop, string> = {
  tomato: "bg-red-500",
  corn: "bg-yellow-300",
  pumpkin: "bg-orange-500",
  beans: "bg-lime-600",
};

const SWATCH_PALE: Record<FieldCrop, string> = {
  tomato: "bg-red-500/40",
  corn: "bg-yellow-300/40",
  pumpkin: "bg-orange-500/40",
  beans: "bg-lime-600/40",
};

const STAGE_LABELS = ["A rough guess", "A better guess", "A sure forecast"];

const SOIL_WORDS = ["worn out", "tired", "fair", "good", "rich"];

/** Soil bar colour: pale and dry when worn, dark and rich when fed. */
const soilBar = (soil: number): string =>
  soil < 0.3
    ? "[&::-webkit-progress-value]:bg-amber-200 [&::-moz-progress-bar]:bg-amber-200"
    : soil < 0.7
      ? "[&::-webkit-progress-value]:bg-amber-600 [&::-moz-progress-bar]:bg-amber-600"
      : "[&::-webkit-progress-value]:bg-amber-900 [&::-moz-progress-bar]:bg-amber-900";

/**
 * Plant for harvest day. The towns send a cart every couple of minutes and
 * pay for what they want ON THAT DAY; the forecast of it is a rough guess
 * early and firms up as the day comes. A crop needs time in the ground, so
 * planting late means a sure forecast but a small crop. The soil wears when
 * the same crop goes in twice in a row, and rests after beans.
 */
export default function MarketPanel({ def, run, onAct }: PanelProps) {
  const planted = isFieldPlanted(run) ? plantedCrop(run) : null;
  const { radioProps } = useRoving(
    FIELD_CROPS.length,
    planted ? FIELD_CROPS.indexOf(planted) : 0
  );
  if (run.phase !== 1 || run.complete) return null;

  const stage = forecastStage(run);
  const soil = soilOf(run);
  const soilWord = SOIL_WORDS[Math.min(4, Math.round(soil * 4))];
  const days = harvestDays(run);

  // Deliberate: arrows only move focus. Planting is a commitment (a new
  // crop starts again from a seed), so it takes Enter, Space or a click.
  return (
    <PanelFrame
      label="The market"
      title="Plant for harvest day"
      tone="orange"
      status={`Harvest day in ${clock(secondsToHarvest(run))}`}
      statusActive={planted === null}
      testId="lm-market"
      data={{
        "data-planted": planted ?? "none",
        "data-stage": stage,
      }}
      result={dayResultLine(run)}
      resultTestId="lm-market-result"
      resultKey={days}
    >
      <p className="font-mono text-sm text-slate-200">
        The towns pay for what they want on harvest day. A crop needs about{" "}
        {TUNING.market.growSeconds} seconds in the ground to grow all the way.
      </p>
      <div className="space-y-1">
        <progress
          aria-label="Time to harvest day"
          max={TUNING.market.daySeconds}
          value={Math.round(daySeconds(run))}
          className="block h-2 w-full appearance-none border-0 bg-slate-700 [&::-webkit-progress-bar]:bg-slate-700 [&::-webkit-progress-value]:bg-orange-400 [&::-moz-progress-bar]:bg-orange-400"
        />
        <p
          data-testid="lm-market-stage"
          className="font-mono text-xs text-orange-100"
        >
          Forecast: {STAGE_LABELS[stage]}.
        </p>
      </div>
      <div
        role="radiogroup"
        aria-label="What to plant"
        className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
      >
        {FIELD_CROPS.map((crop, i) => {
          const f = forecastOf(run, crop);
          const checked = crop === planted;
          const doable = canPerformAction(def, run, plantActionId(crop));
          const grown = grownIfPlantedIn(run, 0);
          const wears = wearsSoil(run, crop);
          return (
            <button
              key={crop}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={CROP_LABELS[crop]}
              aria-describedby={`lm-market-${crop}-order`}
              data-testid={`lm-market-${crop}`}
              {...radioProps(i)}
              onClick={() => {
                if (!checked && doable) onAct(plantActionId(crop));
              }}
              className={`${pixelClass} min-h-14 w-full touch-manipulation space-y-1 border-4 p-2 text-left text-[10px] ${retroFocusClass} ${
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
              <span
                aria-hidden="true"
                className="relative block h-2 w-full bg-black/40"
              >
                <span
                  className={`absolute left-0 top-0 block h-2 ${SWATCH_PALE[crop]} ${BAR_CLASSES[barWidth(f.middle + f.band)]}`}
                />
                <span
                  className={`absolute left-0 top-0 block h-2 ${SWATCH[crop]} ${BAR_CLASSES[barWidth(f.middle - f.band)]}`}
                />
              </span>
              <span
                id={`lm-market-${crop}-order`}
                data-testid={`lm-market-${crop}-order`}
                className="block space-y-0.5 font-mono text-xs font-bold normal-case"
              >
                <span className="block">
                  {crop === "beans"
                    ? `A steady ${forecastText(f).replace(", sure", "")}`
                    : `Towns pay ${forecastText(f)}`}
                  {checked ? ", in the ground" : ""}
                </span>
                <span className="block font-normal">
                  Grown by harvest day: {Math.round(grown * 100)}%
                </span>
                {crop === "beans" && (
                  <span className="block font-normal">
                    Rests the soil, and it comes back rich.
                  </span>
                )}
                {wears && (
                  <span className="block font-normal">
                    Same as last time: wears the soil.
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      <div
        className="space-y-1"
        data-testid="lm-soil"
        data-soil={Math.round(soil * 100)}
      >
        <p className="font-mono text-xs text-amber-100">
          Soil: {soilWord}. Worn soil makes every crop pay less.
        </p>
        <progress
          aria-label="Soil"
          max={100}
          value={Math.round(soil * 100)}
          className={`block h-2 w-full appearance-none border-0 bg-slate-700 [&::-webkit-progress-bar]:bg-slate-700 ${soilBar(soil)}`}
        />
      </div>
      {planted !== null && (
        <p className="font-mono text-xs text-slate-300">
          Planting something else starts again from a seed.
        </p>
      )}
    </PanelFrame>
  );
}
