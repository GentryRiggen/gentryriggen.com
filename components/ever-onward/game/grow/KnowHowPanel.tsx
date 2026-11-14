"use client";

import { useEffect, useState } from "react";
import {
  canAffordProject,
  canPerformAction,
  doneProjects,
  shownProjects,
} from "@/lib/ever-onward/engine/engine";
import { formatNumber } from "@/lib/ever-onward/engine/format";
import {
  FESTIVAL_ACTION_ID,
  FESTIVAL_NAMES,
  festivalCost,
  festivalLeft,
  festivalsSoFar,
  hasKnowhow,
  isFestivalOn,
  isFestivalOpen,
  knowhowOf,
  knowhowPerSecond,
} from "@/lib/ever-onward/universes/grow/knowhow";
import { TUNING } from "@/lib/ever-onward/universes/grow/tuning";
import type { PanelProps } from "../../universes/types";
import PanelFrame from "../retro/PanelFrame";
import { pixelClass, retroFocusClass } from "../retro/retroStyles";

const DONE_LINE_MS = 4000;

/**
 * Know-how: one number with two hungry places to spend it. Projects are
 * permanent (a bigger tank, a cold store, a hybrid seed). A festival is a
 * burst of extra pay that you can hold again and again. What goes to one
 * is not there for the other, so say plainly what each one does.
 */
export default function KnowHowPanel({ def, run, onAct }: PanelProps) {
  const [lastId, setLastId] = useState<string | null>(null);
  useEffect(() => {
    if (!lastId) return;
    const timer = window.setTimeout(() => setLastId(null), DONE_LINE_MS);
    return () => window.clearTimeout(timer);
  }, [lastId]);
  if (!hasKnowhow(run) || run.complete) return null;

  const shown = shownProjects(def, run);
  const done = doneProjects(def, run);
  const isOpen = isFestivalOpen(run);
  if (!isOpen && shown.length === 0 && done.length === 0) return null;

  const have = knowhowOf(run);
  const festival = FESTIVAL_NAMES[run.phase];
  const on = isFestivalOn(run);
  const canHold = canPerformAction(def, run, FESTIVAL_ACTION_ID);
  const last = done.find((p) => p.id === lastId);

  return (
    <PanelFrame
      label="Know-how"
      title="Know-how"
      icon="✎"
      tone="violet"
      status={`${formatNumber(Math.floor(have))} (+${knowhowPerSecond(run).toFixed(1)}/s)`}
      statusTestId="gr-knowhow-count"
      testId="gr-knowhow"
      result={
        last
          ? `${last.name}: done!`
          : on
            ? `${festival} is on: everything pays ${TUNING.knowhow.festivalMult}x.`
            : ""
      }
      resultTestId="gr-knowhow-result"
    >
      <p className="font-mono text-sm text-slate-200">
        Your helpers learn as they work. Spend it on a project that lasts, or on
        a {festival.toLowerCase()} that pays now. Not both.
      </p>
      {shown.length > 0 && (
        <ul className="space-y-2" aria-label="Projects">
          {shown.map((project) => {
            const isAffordable = canAffordProject(run, project);
            const price = project.costs[0].amount;
            const effect = project.effectPreview?.(run);
            return (
              <li
                key={project.id}
                data-testid={`gr-project-${project.id}`}
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
                  id={`gr-project-${project.id}-about`}
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
                  <p
                    id={`gr-project-${project.id}-catch`}
                    className="font-mono text-xs text-amber-200"
                  >
                    The catch: {project.tradeOff}
                  </p>
                )}
                <button
                  type="button"
                  aria-disabled={!isAffordable}
                  aria-describedby={`gr-project-${project.id}-about`}
                  data-testid={`gr-project-${project.id}-start`}
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
                    {formatNumber(price)} know-how
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {isOpen && (
        <div
          data-testid="gr-festival"
          data-on={on ? "yes" : "no"}
          className="space-y-1.5 border-4 border-amber-400/80 bg-amber-950/40 p-2 shadow-[4px_4px_0_#78350f]"
        >
          <h3 className={`${pixelClass} text-[10px] text-amber-200`}>
            {festival}
          </h3>
          <p
            id="gr-festival-about"
            className="font-mono text-sm text-slate-100"
          >
            Everything pays {TUNING.knowhow.festivalMult}x for{" "}
            {TUNING.knowhow.festivalSeconds} seconds. It stacks with whatever is
            wanted: hold it while the towns want what you grow, or just before
            something big. {festivalsSoFar(run)} so far.
          </p>
          <button
            type="button"
            aria-disabled={!canHold}
            aria-describedby="gr-festival-about"
            data-testid="gr-festival-start"
            onClick={() => {
              if (canHold) onAct(FESTIVAL_ACTION_ID);
            }}
            className={`flex min-h-11 w-full touch-manipulation items-center justify-between gap-2 border-4 px-3 py-2 text-left ${retroFocusClass} ${
              canHold
                ? "border-amber-200 bg-amber-400 text-amber-950 shadow-[3px_3px_0_#78350f] hover:bg-amber-300 active:translate-y-0.5 active:shadow-none"
                : "cursor-not-allowed border-slate-600 bg-slate-900 text-slate-400"
            }`}
          >
            <span className={`${pixelClass} text-[10px]`}>
              {on
                ? `On: ${Math.ceil(festivalLeft(run))}s left`
                : canHold
                  ? "Hold one"
                  : "Saving up"}
            </span>
            <span className="font-mono text-xs font-bold tabular-nums">
              {formatNumber(festivalCost())} know-how
            </span>
          </button>
        </div>
      )}
      {done.length > 0 && (
        <p className="font-mono text-xs text-slate-300">
          Done: {done.map((p) => p.name).join(", ")}.
        </p>
      )}
    </PanelFrame>
  );
}
