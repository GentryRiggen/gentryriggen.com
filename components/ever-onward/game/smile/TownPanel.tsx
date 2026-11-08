"use client";

import { useEffect, useState } from "react";
import {
  canAffordProject,
  canPerformAction,
  doneProjects,
  shownProjects,
} from "@/lib/ever-onward/engine/engine";
import { formatNumber } from "@/lib/ever-onward/engine/format";
import type { RunState } from "@/lib/ever-onward/engine/types";
import {
  BUY_FLOAT_ACTION_ID,
  PRICE_DEFS,
  STREETS,
  canBuyFloat,
  cheerMult,
  coinsOf,
  coinsPerSecond,
  crowdLine,
  dayLine,
  dayKind,
  floatCost,
  floatsOn,
  floatsOwned,
  isMoving,
  isRepainting,
  isTownOpen,
  moodOfStreet,
  moveLeft,
  movingTo,
  nextFloatGain,
  paintLeft,
  paintingTo,
  priceActionId,
  priceOf,
  routeMult,
  sendActionId,
  streetLine,
  isGrumpy,
} from "@/lib/ever-onward/universes/smile/town";
import { TUNING } from "@/lib/ever-onward/universes/smile/tuning";
import useRoving from "../grow/useRoving";
import type { PanelProps } from "../../universes/types";
import PanelFrame from "../retro/PanelFrame";
import { pixelClass, retroFocusClass } from "../retro/retroStyles";

const T = TUNING.town;
const DONE_LINE_MS = 4000;
const times = (n: number): string => `${Number(n.toFixed(2))}x`;

/** Width classes for the mood bar, in tenths. */
const FILL: readonly string[] = [
  "w-0",
  "w-[10%]",
  "w-[20%]",
  "w-[30%]",
  "w-[40%]",
  "w-[50%]",
  "w-[60%]",
  "w-[70%]",
  "w-[80%]",
  "w-[90%]",
  "w-full",
];

/**
 * The town's two dials, and what its coins buy. The lemonade stand is a radio
 * group of prices (a higher one brings fewer people but more coins). The
 * parade route sends floats to four streets (a street with none turns grumpy,
 * and each float on a street is worth less than the one before). Nothing is
 * recommended: every card says what it gives and what it costs.
 */
/** "Saving up: about 40 s": when the coins will reach the next float. */
function untilFloat(run: RunState): string {
  const rate = coinsPerSecond(run);
  if (rate <= 0) return "Saving up for a float";
  const seconds = Math.ceil((floatCost(run) - coinsOf(run)) / rate);
  return `Saving up: next float in about ${seconds > 90 ? `${Math.ceil(seconds / 60)} min` : `${seconds} s`}`;
}

export default function TownPanel({ def, run, onAct }: PanelProps) {
  const price = priceOf(run);
  const { radioProps } = useRoving(PRICE_DEFS.length, price);
  const [lastId, setLastId] = useState<string | null>(null);
  useEffect(() => {
    if (!lastId) return;
    const timer = window.setTimeout(() => setLastId(null), DONE_LINE_MS);
    return () => window.clearTimeout(timer);
  }, [lastId]);
  if (!isTownOpen(run) || run.complete) return null;

  const painting = isRepainting(run);
  const target = painting ? paintingTo(run) : price;
  const moving = isMoving(run);
  const shown = shownProjects(def, run);
  const done = doneProjects(def, run);
  const last = done.find((p) => p.id === lastId);
  const canBuild = canPerformAction(def, run, BUY_FLOAT_ACTION_ID);

  return (
    <PanelFrame
      label="The town"
      title="The town"
      icon="◆"
      tone="amber"
      status={`${formatNumber(Math.floor(coinsOf(run)))} coins (+${coinsPerSecond(run).toFixed(1)}/s)`}
      statusTestId="ms-coins"
      testId="ms-town"
      data={{
        "data-price": price,
        "data-painting": painting ? "yes" : "no",
        "data-day": dayKind(run),
        "data-floats": floatsOwned(run),
      }}
      result={last ? `${last.name}: done!` : crowdLine(run)}
      resultTestId="ms-town-result"
    >
      <p
        data-testid="ms-town-day"
        className="font-mono text-sm font-bold text-amber-100"
      >
        {dayLine(run)}
      </p>

      <div data-testid="ms-stand" className="space-y-2">
        <h3 className={`${pixelClass} text-[10px] text-amber-200`}>
          The lemonade stand
        </h3>
        <p className="font-mono text-sm text-slate-200">
          A higher price brings fewer people, but every cup earns coins. Coins
          buy floats and projects; a big crowd earns cheers. Repainting the sign
          takes {T.repaintSeconds} seconds.
        </p>
        <div
          role="radiogroup"
          aria-label="Lemonade price"
          className="grid grid-cols-1 gap-2 sm:grid-cols-5"
        >
          {PRICE_DEFS.map((def2, i) => {
            const checked = i === target;
            const doable = canPerformAction(def, run, priceActionId(i));
            return (
              <button
                key={def2.label}
                {...radioProps(i)}
                type="button"
                role="radio"
                aria-checked={checked}
                aria-disabled={!checked && !doable}
                aria-label={`Price: ${def2.label}`}
                aria-describedby={`ms-price-${i}-note`}
                data-testid={`ms-price-${i}`}
                onClick={() => {
                  if (!checked && doable) onAct(priceActionId(i));
                }}
                className={`${pixelClass} min-h-14 w-full touch-manipulation space-y-1.5 border-4 p-2 text-left text-[10px] ${retroFocusClass} ${
                  checked
                    ? "border-amber-200 bg-amber-400 text-amber-950 shadow-[4px_4px_0_#78350f]"
                    : "border-slate-500 bg-slate-800 text-slate-100 shadow-[4px_4px_0_#0f172a] hover:bg-slate-700 active:translate-y-0.5 active:shadow-none"
                }`}
              >
                <span className="block">{def2.label}</span>
                <span
                  id={`ms-price-${i}-note`}
                  className="block font-mono text-xs leading-snug font-bold normal-case"
                >
                  <span className="block">+ {def2.plus}</span>
                  <span className="block">− {def2.minus}</span>
                </span>
              </button>
            );
          })}
        </div>
        <p className="font-mono text-xs font-bold text-amber-100 tabular-nums">
          {painting
            ? `Repainting the sign: ${Math.ceil(paintLeft(run))}s left, and the crowd stays away.`
            : `Cheers pay ${times(cheerMult(run))} with this crowd.`}
        </p>
      </div>

      <div data-testid="ms-route" className="space-y-2">
        <h3 className={`${pixelClass} text-[10px] text-amber-200`}>
          The parade route
        </h3>
        <p className="font-mono text-sm text-slate-200">
          Floats cheer a street. A street with no float gets grumpy and drags
          the whole town down, and every float on one street is worth less than
          the one before. A moved float is on the road for {T.moveSeconds}{" "}
          seconds. The route pays {times(routeMult(run))} now.
        </p>
        <ul className="grid gap-2 sm:grid-cols-2" aria-label="Streets">
          {STREETS.map((street, i) => {
            const mood = moodOfStreet(run, i);
            const grumpy = isGrumpy(run, i);
            const doable = canPerformAction(def, run, sendActionId(i));
            return (
              <li
                key={street.id}
                data-testid={`ms-street-${i}`}
                data-grumpy={grumpy ? "yes" : "no"}
                className={`space-y-1.5 border-4 p-2 ${
                  grumpy
                    ? "border-rose-400 bg-rose-950/50"
                    : "border-slate-700 bg-slate-950/85"
                }`}
              >
                <h4 className={`${pixelClass} text-[10px] text-slate-50`}>
                  {street.name}
                </h4>
                <p className="font-mono text-xs font-bold text-slate-100 tabular-nums">
                  {floatsOn(run, i)}{" "}
                  {floatsOn(run, i) === 1 ? "float" : "floats"}
                  {moving && movingTo(run) === i
                    ? `, one on the way (${Math.ceil(moveLeft(run))}s)`
                    : ""}
                  . {streetLine(run, i)}.
                </p>
                <p className="font-mono text-xs text-slate-300 tabular-nums">
                  + {Math.round(nextFloatGain(run, i) * 100)}% more cheer from
                  one more float
                </p>
                <span
                  aria-hidden="true"
                  className="block h-1.5 w-full bg-black/40"
                >
                  <span
                    className={`block h-1.5 ${grumpy ? "bg-rose-400" : "bg-amber-300"} ${FILL[Math.round(mood * 10)]}`}
                  />
                </span>
                <button
                  type="button"
                  aria-disabled={!doable}
                  data-testid={`ms-send-${i}`}
                  onClick={() => {
                    if (doable) onAct(sendActionId(i));
                  }}
                  className={`flex min-h-11 w-full touch-manipulation items-center justify-between gap-2 border-4 px-3 py-2 text-left ${retroFocusClass} ${
                    doable
                      ? "border-amber-200 bg-amber-400 text-amber-950 shadow-[3px_3px_0_#78350f] hover:bg-amber-300 active:translate-y-0.5 active:shadow-none"
                      : "cursor-not-allowed border-slate-600 bg-slate-900 text-slate-400"
                  }`}
                >
                  <span className={`${pixelClass} text-[10px]`}>
                    Send a float here
                  </span>
                  <span className="font-mono text-xs font-bold">
                    {moving
                      ? "On the road"
                      : "From the street that misses it least"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          aria-disabled={!canBuild}
          data-testid="ms-buy-float"
          onClick={() => {
            if (canBuild) onAct(BUY_FLOAT_ACTION_ID);
          }}
          className={`flex min-h-11 w-full touch-manipulation items-center justify-between gap-2 border-4 px-3 py-2 text-left ${retroFocusClass} ${
            canBuild
              ? "border-lime-200 bg-lime-400 text-lime-950 shadow-[3px_3px_0_#365314] hover:bg-lime-300 active:translate-y-0.5 active:shadow-none"
              : "cursor-not-allowed border-slate-600 bg-slate-900 text-slate-400"
          }`}
        >
          <span className={`${pixelClass} text-[10px]`}>
            {canBuyFloat(run)
              ? canBuild
                ? "Build another float"
                : untilFloat(run)
              : "All the floats are built"}
          </span>
          {canBuyFloat(run) && (
            <span className="font-mono text-xs font-bold tabular-nums">
              {formatNumber(floatCost(run))} coins
            </span>
          )}
        </button>
      </div>

      {shown.length > 0 && (
        <ul className="space-y-2" aria-label="Projects">
          {shown.map((project) => {
            const isAffordable = canAffordProject(run, project);
            const effect = project.effectPreview?.(run);
            return (
              <li
                key={project.id}
                data-testid={`ms-project-${project.id}`}
                className={`space-y-1.5 border-4 p-2 ${
                  isAffordable
                    ? "border-violet-300 bg-violet-950/50 shadow-[4px_4px_0_#4c1d95]"
                    : "border-slate-700 bg-slate-950/85"
                }`}
              >
                <h3 className={`${pixelClass} text-[10px] text-slate-50`}>
                  {project.name}
                </h3>
                <p
                  id={`ms-project-${project.id}-about`}
                  className="font-mono text-sm text-slate-100"
                >
                  {project.description}
                </p>
                {effect && (
                  <p className="font-mono text-xs font-bold text-emerald-200 tabular-nums">
                    {effect}
                  </p>
                )}
                {project.tradeOff && (
                  <p className="font-mono text-xs text-amber-200">
                    The catch: {project.tradeOff}
                  </p>
                )}
                <button
                  type="button"
                  aria-disabled={!isAffordable}
                  aria-describedby={`ms-project-${project.id}-about`}
                  data-testid={`ms-project-${project.id}-start`}
                  onClick={() => {
                    if (!isAffordable) return;
                    setLastId(project.id);
                    onAct(project.id);
                  }}
                  className={`flex min-h-11 w-full touch-manipulation items-center justify-between gap-2 border-4 px-3 py-2 text-left ${retroFocusClass} ${
                    isAffordable
                      ? "border-violet-200 bg-violet-400 text-violet-950 shadow-[3px_3px_0_#4c1d95] hover:bg-violet-300 active:translate-y-0.5 active:shadow-none"
                      : "cursor-not-allowed border-slate-600 bg-slate-900 text-slate-400"
                  }`}
                >
                  <span className={`${pixelClass} text-[10px]`}>
                    {isAffordable ? "Start" : "Saving up"}
                  </span>
                  <span className="font-mono text-xs font-bold tabular-nums">
                    {formatNumber(project.costs[0].amount)} coins
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {done.length > 0 && (
        <p className="font-mono text-xs text-slate-300">
          Done: {done.map((p) => p.name).join(", ")}.
        </p>
      )}
    </PanelFrame>
  );
}
