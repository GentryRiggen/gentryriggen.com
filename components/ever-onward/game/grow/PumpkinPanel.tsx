"use client";

import { canPerformAction } from "@/lib/ever-onward/engine/engine";
import { formatNumber } from "@/lib/ever-onward/engine/format";
import { secondsToHarvest } from "@/lib/ever-onward/universes/grow/market";
import {
  ENTER_ACTION_ID,
  FEED_ACTION_ID,
  RIBBON_LABELS,
  RIBBONS,
  SIZE_NAMES,
  chancesAt,
  entriesSoFar,
  expectedSeconds,
  feedCost,
  isDayFree,
  isGiant,
  isJudging,
  isPumpkinOpen,
  pumpkinResultLine,
  pumpkinStep,
  splitChanceNow,
  splitsSoFar,
} from "@/lib/ever-onward/universes/grow/pumpkin";
import { farmPayPerSecond } from "@/lib/ever-onward/universes/grow/tick";
import { TUNING } from "@/lib/ever-onward/universes/grow/tuning";
import type { PanelProps } from "../../universes/types";
import PanelFrame from "../retro/PanelFrame";
import { pixelClass, retroFocusClass } from "../retro/retroStyles";

const clock = (seconds: number): string => {
  const whole = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

const pct = (n: number): string => `${Math.round(n * 100)}%`;

const button = (isOn: boolean, tone: "feed" | "enter") =>
  `${pixelClass} flex min-h-14 w-full touch-manipulation flex-col items-start justify-center gap-1 border-4 p-2 text-left text-[10px] aria-disabled:cursor-not-allowed ${retroFocusClass} ${
    isOn
      ? tone === "feed"
        ? "border-lime-200 bg-lime-500 text-lime-950 shadow-[4px_4px_0_#365314] hover:bg-lime-400 active:translate-y-0.5 active:shadow-none"
        : "border-orange-200 bg-orange-400 text-orange-950 shadow-[4px_4px_0_#7c2d12] hover:bg-orange-300 active:translate-y-0.5 active:shadow-none"
      : "border-slate-600 bg-slate-800 text-slate-500 shadow-[4px_4px_0_#0f172a]"
  }`;

/**
 * The prize pumpkin: on every harvest day, feed it (it grows, and might
 * split) or enter it at the fair, not both. The risk and the odds are shown
 * before every choice. A split pumpkin takes everything fed to it with it.
 */
export default function PumpkinPanel({ def, run, onAct }: PanelProps) {
  if (!isPumpkinOpen(run) || run.complete) return null;
  const farmPay = farmPayPerSecond(run);
  const step = pumpkinStep(run);
  const steps = TUNING.pumpkin.steps;
  const free = isDayFree(run);
  const judging = isJudging(run);
  const giant = isGiant(run);
  const chances = chancesAt(step);
  const next = chancesAt(Math.min(steps, step + 1));
  const act = (id: string) => {
    if (canPerformAction(def, run, id)) onAct(id);
  };
  const canFeed = canPerformAction(def, run, FEED_ACTION_ID);
  const canEnter = canPerformAction(def, run, ENTER_ACTION_ID);
  const cost = feedCost(run, farmPay);
  const wait = judging
    ? "The judges are walking the row."
    : `Next harvest day in ${clock(secondsToHarvest(run))}. Feed it or enter it then.`;

  return (
    <PanelFrame
      label="The prize pumpkin"
      title="The prize pumpkin"
      icon="●"
      tone="lime"
      status={free ? "Fair day" : judging ? "Judging" : "Waiting"}
      statusActive={free}
      testId="lm-pumpkin"
      data={{
        "data-step": step,
        "data-free": free ? "true" : "false",
      }}
      result={pumpkinResultLine(run)}
      resultTestId="lm-pumpkin-result"
      resultKey={entriesSoFar(run) + splitsSoFar(run)}
    >
      <div className="space-y-1">
        <p
          data-testid="lm-pumpkin-size"
          className="font-mono text-sm text-lime-100"
        >
          {SIZE_NAMES[step]} ({step} of {steps}).
        </p>
        <ol aria-hidden="true" className="flex gap-1">
          {Array.from({ length: steps + 1 }, (_, i) => (
            <li
              key={i}
              className={`h-3 flex-1 border-2 ${
                i <= step
                  ? "border-orange-200 bg-orange-500"
                  : "border-slate-600 bg-slate-800"
              }`}
            />
          ))}
        </ol>
        <p
          data-testid="lm-pumpkin-odds"
          className="font-mono text-xs text-slate-200"
        >
          If you enter it now:{" "}
          {RIBBONS.map((r, i) => `${RIBBON_LABELS[r]} ${pct(chances[i])}`).join(
            ", "
          )}
          . About +
          {formatNumber(
            Math.floor(expectedSeconds(step) * Math.max(1, farmPay))
          )}{" "}
          harvest.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          data-testid="lm-pumpkin-feed"
          aria-disabled={!canFeed}
          onClick={() => act(FEED_ACTION_ID)}
          className={button(canFeed, "feed")}
        >
          <span>{giant ? "It is a giant" : "Feed it"}</span>
          {!giant && (
            <span className="font-mono text-xs font-bold normal-case">
              Costs {formatNumber(cost)} harvest. Chance it splits:{" "}
              {pct(splitChanceNow(run))}. If it holds: blue ribbon{" "}
              {pct(next[0])}.
            </span>
          )}
        </button>
        <button
          type="button"
          data-testid="lm-pumpkin-enter"
          aria-disabled={!canEnter}
          onClick={() => act(ENTER_ACTION_ID)}
          className={button(canEnter, "enter")}
        >
          <span>Enter it now</span>
          <span className="font-mono text-xs font-bold normal-case">
            Or wait another day to feed it. Entering starts a new seedling.
          </span>
        </button>
      </div>
      {!free && (
        <p
          data-testid="lm-pumpkin-wait"
          className="font-mono text-xs text-slate-300"
        >
          {wait}
        </p>
      )}
    </PanelFrame>
  );
}
