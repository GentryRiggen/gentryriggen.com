"use client";

import { useEffect, useState } from "react";
import {
  canAffordProject,
  canPerformAction,
  doneProjects,
  shownProjects,
} from "@/lib/ever-onward/engine/engine";
import { formatNumber } from "@/lib/ever-onward/engine/format";
import { forkParadeMult } from "@/lib/ever-onward/universes/smile/forks";
import {
  PARADE_ACTION_ID,
  BROADCAST_NAME,
  hasKnowhow,
  isParadeOn,
  isParadeOpen,
  isParadeResting,
  knowhowOf,
  knowhowPerSecond,
  paradeCost,
  paradeLeft,
  paradeSeconds,
  paradesSoFar,
} from "@/lib/ever-onward/universes/smile/knowhow";
import { TUNING } from "@/lib/ever-onward/universes/smile/tuning";
import type { PanelProps } from "../../universes/types";
import PanelFrame from "../retro/PanelFrame";
import { pixelClass, retroFocusClass } from "../retro/retroStyles";

const DONE_LINE_MS = 4000;

/**
 * Know-how: one number with two hungry places to spend it. Projects are
 * permanent (a big top, shady corners, a handbook). A parade is a burst of
 * extra pay that you can hold again and again when the crowd is cool. What
 * goes to one is not there for the other, so say plainly what each one does.
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
  const isOpen = isParadeOpen(run);
  if (!isOpen && shown.length === 0 && done.length === 0) return null;

  const have = knowhowOf(run);
  const name = BROADCAST_NAME;
  const on = isParadeOn(run);
  const resting = isParadeResting(run);
  const canHold = canPerformAction(def, run, PARADE_ACTION_ID);
  const last = done.find((p) => p.id === lastId);

  return (
    <PanelFrame
      label="Know-how"
      title="Know-how"
      icon="✎"
      tone="violet"
      status={`${formatNumber(Math.floor(have))} (+${knowhowPerSecond(run).toFixed(1)}/s)`}
      statusTestId="ms-knowhow-count"
      testId="ms-knowhow"
      result={
        last
          ? `${last.name}: done!`
          : on
            ? `The ${name.toLowerCase()} is on: everything pays ${Number(forkParadeMult().toFixed(2))}x or more.`
            : ""
      }
      resultTestId="ms-knowhow-result"
    >
      <p className="font-mono text-sm text-slate-200">
        Your helpers learn as they work. Spend it on a project that lasts, or on
        a {name.toLowerCase()} that pays now. Some projects are cheap in grins
        and cost real smiles. Not all of them do.
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
                  <ul
                    data-testid={`ms-project-${project.id}-effect`}
                    className="space-y-0.5 font-mono text-xs font-bold tabular-nums"
                  >
                    {effect.split("\n").map((line) => (
                      <li
                        key={line}
                        className={
                          line.startsWith("−")
                            ? "text-fuchsia-200"
                            : "text-emerald-200"
                        }
                      >
                        {line}
                      </li>
                    ))}
                  </ul>
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
          data-testid="ms-parade"
          data-on={on ? "yes" : "no"}
          className="space-y-1.5 border-4 border-amber-400/80 bg-amber-950/40 p-2 shadow-[4px_4px_0_#78350f]"
        >
          <h3 className={`${pixelClass} text-[10px] text-amber-200`}>{name}</h3>
          <p id="ms-parade-about" className="font-mono text-sm text-slate-100">
            Everything pays {Number(forkParadeMult().toFixed(2))}x or more for{" "}
            {paradeSeconds()} seconds. Real smiles get painted over{" "}
            {Math.round((TUNING.world.broadcastPaint - 1) * 100)}% faster while
            it plays, and the crowd needs a short rest after.{" "}
            {paradesSoFar(run)} so far.
          </p>
          <button
            type="button"
            aria-disabled={!canHold}
            aria-describedby="ms-parade-about"
            data-testid="ms-parade-start"
            onClick={() => {
              if (canHold) onAct(PARADE_ACTION_ID);
            }}
            className={`flex min-h-11 w-full touch-manipulation items-center justify-between gap-2 border-4 px-3 py-2 text-left ${retroFocusClass} ${
              canHold
                ? "border-amber-200 bg-amber-400 text-amber-950 shadow-[3px_3px_0_#78350f] hover:bg-amber-300 active:translate-y-0.5 active:shadow-none"
                : "cursor-not-allowed border-slate-600 bg-slate-900 text-slate-400"
            }`}
          >
            <span className={`${pixelClass} text-[10px]`}>
              {on
                ? `On: ${Math.ceil(paradeLeft(run) - TUNING.knowhow.paradeRest)}s left`
                : resting
                  ? "Catching their breath"
                  : canHold
                    ? "Start one"
                    : "Not yet"}
            </span>
            <span className="font-mono text-xs font-bold tabular-nums">
              {formatNumber(paradeCost())} know-how
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
