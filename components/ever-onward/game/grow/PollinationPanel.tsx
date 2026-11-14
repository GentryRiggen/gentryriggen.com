"use client";

import { canPerformAction } from "@/lib/ever-onward/engine/engine";
import { formatNumber } from "@/lib/ever-onward/engine/format";
import {
  BEDS,
  RARE_FLOWERS,
  SELL_ALL_ID,
  SELL_HALF_ID,
  addBeeActionId,
  bedEffect,
  beeCount,
  beeResultLine,
  beesGone,
  beesHome,
  beesOn,
  bloomOf,
  honeyOf,
  honeyPrice,
  isBeesOpen,
  isDormant,
  isPlanted,
  needsBees,
  plantActionId,
  plantCost,
  rareCount,
  secondsToWilt,
  takeBeeActionId,
  winterNeeds,
} from "@/lib/ever-onward/universes/grow/bees";
import { TUNING } from "@/lib/ever-onward/universes/grow/tuning";
import { seasonOf } from "@/lib/ever-onward/universes/grow/seasons";
import { incomePerSecond } from "@/lib/ever-onward/universes/grow/tick";
import type { PanelProps } from "../../universes/types";
import PanelFrame from "../retro/PanelFrame";
import { pixelClass, retroFocusClass } from "../retro/retroStyles";

const clock = (seconds: number): string => {
  const whole = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

const smallButton = (isOn: boolean) =>
  `${pixelClass} inline-flex min-h-11 min-w-11 touch-manipulation items-center justify-center border-4 px-2 text-xs transition-transform aria-disabled:cursor-not-allowed ${retroFocusClass} ${
    isOn
      ? "border-amber-200 bg-amber-400 text-amber-950 shadow-[3px_3px_0_#78350f] hover:bg-amber-300 active:translate-y-0.5 active:shadow-none"
      : "border-slate-600 bg-slate-800 text-slate-500 shadow-[3px_3px_0_#0f172a]"
  }`;

/** Bloom bar colours: healthy, tiring, about to wilt. */
const barColor = (bloom: number) =>
  bloom >= 0.6
    ? "[&::-webkit-progress-value]:bg-lime-400 [&::-moz-progress-bar]:bg-lime-400"
    : bloom >= 0.3
      ? "[&::-webkit-progress-value]:bg-amber-400 [&::-moz-progress-bar]:bg-amber-400"
      : "[&::-webkit-progress-value]:bg-red-500 [&::-moz-progress-bar]:bg-red-500";

const BED_ICONS = ["☘", "✺", "❋", "♣"] as const;

/**
 * Pollination: plant flower beds, send the bees to them, and decide what to
 * do with the honey. Every bed gives something different and tires as it is
 * worked; a bed worked too hard wilts and has to be planted again.
 */
export default function PollinationPanel({ def, run, onAct }: PanelProps) {
  if (!isBeesOpen(run) || run.complete) return null;
  const income = incomePerSecond(run);
  const act = (id: string) => {
    if (canPerformAction(def, run, id)) onAct(id);
  };
  const honey = honeyOf(run);
  const need = winterNeeds(run);
  const winter = isDormant(run);
  const price = honeyPrice(run, income);
  const rare = rareCount(run);
  const gone = beesGone(run);
  const season = seasonOf(run);

  return (
    <PanelFrame
      label="Bees and flowers"
      title="Bees and flowers"
      icon="✿"
      tone="amber"
      status={`${beeCount(run)} bees · ${beesHome(run)} at the hive`}
      statusActive={needsBees(run)}
      testId="eo-bees"
      result={beeResultLine(run)}
      resultTestId="eo-bees-result"
      footer={
        <div className="space-y-1 font-mono text-xs text-slate-300">
          <p data-testid="eo-bees-rare">
            Rare flowers: {rare}/{TUNING.pollen.rareMax}
            {rare > 0 &&
              ` (${RARE_FLOWERS.slice(0, 3).join(", ")}…): the garden ripens +${Math.round(
                rare * TUNING.pollen.rareRipen * 100
              )}% for good`}
            .
          </p>
          <p>
            Two neighbouring beds that are both healthy (60%+) and both being
            worked can cross into a rare flower. Work beds hard and they never
            will.
          </p>
          {gone > 0 && (
            <p className="text-red-300">
              {gone} hungry bee{gone === 1 ? "" : "s"} flew away. They drift
              back once winter is over.
            </p>
          )}
        </div>
      }
    >
      <div
        data-testid="eo-bees-honey"
        className="space-y-2 border-2 border-amber-700 bg-amber-950/40 p-2"
      >
        <p className="font-mono text-xs text-amber-100">
          <span className={`${pixelClass} text-[10px] text-amber-300`}>
            Honey {formatNumber(Math.floor(honey))}
          </span>{" "}
          · winter takes {formatNumber(Math.ceil(need))} ·{" "}
          {honey >= need ? (
            <span className="text-lime-300">enough for winter</span>
          ) : (
            <span className="text-red-300">
              not enough for winter: bees will leave
            </span>
          )}
        </p>
        <p className="font-mono text-xs text-slate-300">
          {winter
            ? "Winter: the bees are home eating honey. Honey sells for the most now."
            : `Sells for ${formatNumber(Math.floor(price))} seeds each in ${season} (most in winter).`}
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            { id: SELL_HALF_ID, label: "Sell half" },
            { id: SELL_ALL_ID, label: "Sell all" },
          ].map(({ id, label }) => {
            const ok = canPerformAction(def, run, id);
            return (
              <button
                key={id}
                type="button"
                data-testid={`eo-bees-${id}`}
                aria-disabled={!ok}
                onClick={() => act(id)}
                className={`${smallButton(ok)} px-3`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {BEDS.map((bed, i) => {
          const planted = isPlanted(run, i);
          const bloom = bloomOf(run, i);
          const wilt = secondsToWilt(run, i);
          const n = beesOn(run, i);
          const plantId = plantActionId(i);
          const canPlant = canPerformAction(def, run, plantId);
          return (
            <li
              key={bed.kind}
              data-testid={`eo-bed-${i}`}
              data-planted={planted ? "true" : "false"}
              className="space-y-1.5 border-2 border-slate-700 bg-slate-900/80 p-2"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className={`${pixelClass} text-[10px] text-lime-100`}>
                  <span aria-hidden="true">{BED_ICONS[i]} </span>
                  {bed.name}
                </p>
                {planted && (
                  <p className="font-mono text-xs text-slate-300">
                    {Math.round(bloom * 100)}% bloom
                  </p>
                )}
              </div>
              {planted && (
                <progress
                  aria-label={`${bed.name} bloom`}
                  max={100}
                  value={Math.round(bloom * 100)}
                  className={`block h-2 w-full appearance-none border-0 bg-slate-700 [&::-webkit-progress-bar]:bg-slate-700 ${barColor(bloom)}`}
                />
              )}
              <p className="font-mono text-xs text-amber-100">
                {bedEffect(run, i)}
              </p>
              {planted && wilt !== null && (
                <p
                  className={`font-mono text-xs ${wilt < TUNING.pollen.warnSeconds ? "text-red-300" : "text-slate-400"}`}
                >
                  Wilts in {clock(wilt)} at this pace
                </p>
              )}
              {planted ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label={`Call a bee home from the ${bed.name.toLowerCase()}`}
                    data-testid={`eo-bed-${i}-take`}
                    aria-disabled={
                      !canPerformAction(def, run, takeBeeActionId(i))
                    }
                    onClick={() => act(takeBeeActionId(i))}
                    className={smallButton(
                      canPerformAction(def, run, takeBeeActionId(i))
                    )}
                  >
                    −
                  </button>
                  <span
                    className={`${pixelClass} min-w-16 text-center text-xs text-amber-200`}
                    data-testid={`eo-bed-${i}-bees`}
                  >
                    {n} bee{n === 1 ? "" : "s"}
                  </span>
                  <button
                    type="button"
                    aria-label={`Send a bee to the ${bed.name.toLowerCase()}`}
                    data-testid={`eo-bed-${i}-add`}
                    aria-disabled={
                      !canPerformAction(def, run, addBeeActionId(i))
                    }
                    onClick={() => act(addBeeActionId(i))}
                    className={smallButton(
                      canPerformAction(def, run, addBeeActionId(i))
                    )}
                  >
                    +
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  data-testid={`eo-bed-${i}-plant`}
                  aria-disabled={!canPlant}
                  onClick={() => act(plantId)}
                  className={`${smallButton(canPlant)} w-full`}
                >
                  Plant · {formatNumber(plantCost(run, i, income))} seeds
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </PanelFrame>
  );
}
