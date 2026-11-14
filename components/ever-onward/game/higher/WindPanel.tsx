"use client";

import { canPerformAction } from "@/lib/ever-onward/engine/engine";
import { formatNumber } from "@/lib/ever-onward/engine/format";
import {
  FORECAST_NAMES,
  TIE_ACTION_ID,
  dropInGust,
  forecastOf,
  gustIn,
  hookOf,
  isBlowing,
  isFetching,
  isNoCrane,
  isRestringing,
  isResting,
  isSkyOpen,
  isStrongGust,
  tieState,
  tieWait,
} from "@/lib/ever-onward/universes/higher/sky";
import { TUNING } from "@/lib/ever-onward/universes/higher/tuning";
import type { PanelProps } from "../../universes/types";
import PanelFrame from "../retro/PanelFrame";
import { pixelClass, retroFocusClass } from "../retro/retroStyles";

const K = TUNING.sky;

/** One lit step of the forecast: calm, clouds, a sure gust. */
const STEP_STYLE: readonly string[] = [
  "border-sky-300 bg-sky-500 text-sky-950",
  "border-slate-300 bg-slate-400 text-slate-950",
  "border-rose-200 bg-rose-500 text-rose-950",
];

/**
 * The Sky's forecast and the tie-down. The three steps light up one at a
 * time (a calm sky, clouds gathering, a sure gust), and the sure gust says
 * how long you have. Tying down keeps the load safe, and the crane earns
 * nothing while you do. The panel shows both sides and never which to pick:
 * that depends on how tight the cable is and how strong the gust is.
 */
export default function WindPanel({ def, run, onAct }: PanelProps) {
  if (!isSkyOpen(run)) return null;
  const wx = isBlowing(run) ? 2 : forecastOf(run);
  const tie = tieState(run);
  const canTie = canPerformAction(def, run, TIE_ACTION_ID);
  const waiting = tieWait(run);
  const status = isBlowing(run) ? "gust!" : FORECAST_NAMES[wx].toLowerCase();
  const resting = isFetching(run)
    ? "The crew is fetching a dropped load. No beams until it is back."
    : isRestringing(run)
      ? "The crew is restringing the cable. No beams until it is done."
      : isResting(run)
        ? "The crew is resting after the failed climb. No beams yet."
        : "";
  return (
    <PanelFrame
      label="The wind forecast"
      title="Wind and tying down"
      icon="/"
      tone="sky"
      status={status}
      statusActive={wx >= 1}
      testId="bh-wind"
      data={{
        "data-forecast": wx,
        "data-tie": tie,
        "data-blowing": isBlowing(run) ? "1" : "0",
      }}
      result={resting}
      resultTestId="bh-wind-result"
      resultTone="amber"
    >
      <ol
        aria-label="The forecast, in three steps"
        className="grid grid-cols-3 gap-1"
      >
        {FORECAST_NAMES.map((name, i) => (
          <li
            key={name}
            data-testid={`bh-forecast-${i}`}
            aria-current={i === wx ? "step" : undefined}
            className={`${pixelClass} border-2 p-1.5 text-center text-[10px] leading-tight ${
              i === wx
                ? STEP_STYLE[i]
                : "border-slate-700 bg-slate-900 text-slate-500"
            }`}
          >
            {name}
          </li>
        ))}
      </ol>
      <p
        data-testid="bh-forecast-note"
        className="font-mono text-xs text-slate-200"
      >
        {isBlowing(run)
          ? "A gust is blowing right now."
          : wx === 2
            ? `${isStrongGust(run) ? "A strong gust" : "A light gust"} in ${gustIn(run)} sec. It is sure. ${
                isStrongGust(run)
                  ? "A strong one drops a loose load far more often."
                  : "A light one rarely drops anything."
              }`
            : wx === 1
              ? "Clouds are gathering. A gust may follow, or the sky may clear."
              : "The sky is calm. Clouds may gather next."}
      </p>
      <p className="font-mono text-xs text-slate-300">
        On the hook: {formatNumber(Math.floor(hookOf(run)))} beams. A gust can
        drop them
        {wx === 2 || isBlowing(run)
          ? ` (about ${Math.round(dropInGust(1, 1, isStrongGust(run) ? K.strongMult : K.lightMult) * 100)}% on a taut cable)`
          : ""}
        .
      </p>
      <button
        type="button"
        aria-disabled={!canTie}
        data-testid="bh-tie"
        onClick={() => {
          if (canTie) onAct(TIE_ACTION_ID);
        }}
        className={`${pixelClass} min-h-11 w-full touch-manipulation space-y-1 border-4 p-2 text-left text-[10px] ${retroFocusClass} ${
          canTie
            ? "border-sky-200 bg-sky-400 text-sky-950 shadow-[3px_3px_0_#075985] hover:bg-sky-300 active:translate-y-0.5 active:shadow-none"
            : "cursor-not-allowed border-slate-600 bg-slate-900 text-slate-400"
        }`}
      >
        <span className="block">
          {tie === "tying"
            ? `Tying down… ${waiting} sec`
            : tie === "untying"
              ? `Untying… ${waiting} sec`
              : tie === "tied"
                ? "Untie"
                : "Tie down"}
        </span>
        <span className="block font-mono text-xs leading-snug font-bold normal-case">
          {tie === "tied" || tie === "untying"
            ? "+ Nothing can fall or snap"
            : "+ A gust cannot drop a beam or snap a cable"}
          <br />
          {isNoCrane(run)
            ? "- The crane is off for the climb"
            : `- Earns nothing while tied. Takes ${K.tieSeconds} sec to tie and ${K.untieSeconds} to untie`}
        </span>
      </button>
    </PanelFrame>
  );
}
