"use client";

import { memo } from "react";
import { canPerformAction } from "@/lib/ever-onward/engine/engine";
import {
  RECALL_ACTION,
  STATS,
  downActionId,
  isDialsOpen,
  isRecalling,
  isSettling,
  pointsAt,
  recallLeft,
  spareOf,
  targetOf,
  upActionId,
  wildCount,
  wildWords,
  wildShare,
} from "@/lib/ever-onward/universes/light/design";
import { TUNING } from "@/lib/ever-onward/universes/light/tuning";
import type { PanelProps } from "../universes/types";
import PanelFrame from "./retro/PanelFrame";
import { pixelClass, retroFocusClass } from "./retro/retroStyles";

const D = TUNING.dials;

const TONES = [
  "bg-cyan-300",
  "bg-yellow-300",
  "bg-lime-300",
  "bg-sky-300",
] as const;

const button = `${pixelClass} flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center border-4 text-base ${retroFocusClass}`;

/**
 * The probe design: eight design points split across speed, mirrors, copying
 * and shields. Each row says what a point gives and what it costs, and never
 * which is best. A point taken off a row is on its way for a few seconds
 * before it works anywhere else. Under it, the wild probes: copy too hard
 * and some copies go wild; bringing them home pulls points off copying.
 */
function ProbeDesignPanel({ def, run, onAct }: PanelProps) {
  if (!isDialsOpen(run) || run.complete) return null;
  const spare = spareOf(run);
  const moving = isSettling(run);
  const wild = wildCount(run);
  const recalling = isRecalling(run);
  const recallable = canPerformAction(def, run, RECALL_ACTION);

  return (
    <PanelFrame
      label="Probe design"
      title="Probe Design"
      icon="⚙"
      tone="sky"
      status={spare > 0 ? `${spare} spare` : moving ? "settling" : "ready"}
      statusActive={false}
      testId="lm-design"
      data={{ "data-spare": spare }}
    >
      <p className="font-mono text-xs text-slate-300">
        {D.points} design points. A point you take off waits about{" "}
        {D.settleSeconds} s before it works somewhere else.
      </p>
      <ul className="space-y-2">
        {STATS.map((stat, i) => {
          const working = Math.round(pointsAt(run, i));
          const aimed = targetOf(run, i);
          const canUp = canPerformAction(def, run, upActionId(i));
          const canDown = canPerformAction(def, run, downActionId(i));
          return (
            <li
              key={stat.id}
              data-testid={`lm-design-${stat.id}`}
              data-points={aimed}
              className="flex items-center gap-2 border-2 border-slate-600 bg-slate-900/80 p-2"
            >
              <button
                type="button"
                aria-label={`Less ${stat.name.toLowerCase()}`}
                aria-disabled={!canDown}
                data-testid={`lm-design-down-${stat.id}`}
                onClick={() => canDown && onAct(downActionId(i))}
                className={`${button} border-slate-400 bg-slate-800 text-slate-100 aria-disabled:opacity-40`}
              >
                −
              </button>
              <div className="min-w-0 flex-1 space-y-1">
                <p className={`${pixelClass} text-[10px] text-slate-100`}>
                  {stat.name}
                </p>
                <span className="flex gap-0.5" aria-hidden="true">
                  {Array.from({ length: D.points }, (_, p) => (
                    <span
                      key={p}
                      className={`h-3 flex-1 ${
                        p < working
                          ? TONES[i]
                          : p < aimed
                            ? "border border-dashed border-amber-300 bg-transparent"
                            : "bg-slate-700"
                      }`}
                    />
                  ))}
                </span>
                <p className="font-mono text-xs leading-snug text-emerald-200">
                  + {stat.plus}
                </p>
                <p className="font-mono text-xs leading-snug text-rose-200">
                  − {stat.minus}
                </p>
              </div>
              <button
                type="button"
                aria-label={`More ${stat.name.toLowerCase()}`}
                aria-disabled={!canUp}
                data-testid={`lm-design-up-${stat.id}`}
                onClick={() => canUp && onAct(upActionId(i))}
                className={`${button} border-sky-200 bg-sky-800 text-sky-50 aria-disabled:opacity-40`}
              >
                +
              </button>
            </li>
          );
        })}
      </ul>
      <p
        data-testid="lm-design-note"
        className="font-mono text-xs text-slate-300"
      >
        {spare > 0
          ? `${spare} spare ${spare === 1 ? "point" : "points"}: give them to something.`
          : moving
            ? "Points are on their way."
            : "Every point is working."}
      </p>
      <div
        data-testid="lm-wild"
        data-level={wildShare(run) > 0.005 ? 1 : 0}
        className="space-y-2 border-2 border-slate-600 bg-slate-900/80 p-2"
      >
        <p className="flex items-baseline justify-between gap-2 font-mono text-sm font-bold">
          <span className="text-slate-300">Wild probes</span>
          <span data-testid="lm-wild-words" className="text-rose-200">
            {wildWords(wildShare(run))}
          </span>
        </p>
        <button
          type="button"
          aria-disabled={!recallable}
          data-testid="lm-recall"
          onClick={() => recallable && onAct(RECALL_ACTION)}
          className={`${pixelClass} min-h-11 w-full touch-manipulation border-4 px-2 text-[10px] ${retroFocusClass} ${
            recallable
              ? "border-emerald-100 bg-emerald-400 text-emerald-950 shadow-[3px_3px_0_#064e3b] active:translate-y-0.5 active:shadow-none"
              : "border-slate-600 bg-slate-800 text-slate-400"
          }`}
        >
          {recalling
            ? `Coming home… ${Math.ceil(recallLeft(run))} s`
            : "Bring them home"}
        </button>
        <p className="font-mono text-xs leading-snug text-slate-300">
          {wild < 1
            ? "Copy too hard and some copies go wild. They keep the light for themselves and crowd the fleet."
            : `It pulls ${D.recallPoints} points off copying for ${D.recallSeconds} s.`}
        </p>
      </div>
    </PanelFrame>
  );
}

export default memo(ProbeDesignPanel);
