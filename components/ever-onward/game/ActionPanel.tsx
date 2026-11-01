"use client";

import { useEffect, useRef, useState } from "react";
import {
  canPerformAction,
  visibleActions,
} from "@/lib/ever-onward/engine/engine";
import { formatNumber } from "@/lib/ever-onward/engine/format";
import type {
  ActionView,
  RunState,
  UniverseDef,
} from "@/lib/ever-onward/engine/types";
import { pixelClass, retroFocusClass } from "./retro/retroStyles";

interface ActionPanelProps {
  def: UniverseDef;
  run: RunState;
  onAct: (id: string) => void;
}

/** How many one-second readings a sparkline keeps. */
const HISTORY_SIZE = 40;

/** The last readings of one resource, one per second. */
function useHistory(value: number): number[] {
  const [history, setHistory] = useState<number[]>([]);
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);
  useEffect(() => {
    const interval = window.setInterval(() => {
      setHistory((h) => [...h.slice(-(HISTORY_SIZE - 1)), latest.current]);
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);
  return history;
}

const TONES = {
  good: "border-emerald-400 bg-emerald-950 text-emerald-200",
  bad: "border-red-400 bg-red-950 text-red-200",
  neutral: "border-slate-500 bg-slate-900 text-slate-200",
} as const;

function Sparkline({ values }: { values: readonly number[] }) {
  if (values.length < 2)
    return <span className="h-6 w-16" aria-hidden="true" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(0.01, max - min);
  const step = 64 / (HISTORY_SIZE - 1);
  const points = values
    .map(
      (v, i) =>
        `${(i * step).toFixed(1)},${(22 - ((v - min) / span) * 20).toFixed(1)}`
    )
    .join(" ");
  return (
    <svg
      viewBox="0 0 64 24"
      className="h-6 w-16 shrink-0 text-amber-300"
      aria-hidden="true"
      data-testid="lm-sparkline"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="miter"
        strokeLinecap="square"
        shapeRendering="crispEdges"
      />
    </svg>
  );
}

function ActionCard({
  view,
  run,
  isDoable,
  onAct,
}: {
  view: ActionView;
  run: RunState;
  isDoable: boolean;
  onAct: () => void;
}) {
  const history = useHistory(
    view.trendResource ? (run.resources[view.trendResource] ?? 0) : 0
  );
  return (
    <button
      type="button"
      aria-disabled={!isDoable}
      onClick={() => {
        if (isDoable) onAct();
      }}
      className={`flex w-full touch-manipulation items-center justify-between gap-3 border-4 p-3 text-left transition-transform aria-disabled:cursor-not-allowed ${retroFocusClass} ${
        isDoable
          ? "border-cyan-300 bg-cyan-950/50 text-cyan-50 shadow-[4px_4px_0_#164e63] hover:bg-cyan-900/60 active:translate-y-0.5 active:shadow-none"
          : "border-slate-700 bg-slate-950/85 text-slate-400 shadow-[4px_4px_0_#0f172a]"
      }`}
    >
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span
            className={`${pixelClass} text-[10px] ${isDoable ? "text-cyan-200" : ""}`}
          >
            {view.label}
          </span>
          {view.hint && (
            <span
              data-testid="lm-action-hint"
              className={`${pixelClass} border-2 px-1.5 py-1 text-[8px] ${TONES[view.hint.tone]}`}
            >
              {view.hint.text}
            </span>
          )}
        </span>
        {view.detail && (
          <span className="mt-1.5 block font-mono text-sm tabular-nums">
            {view.detail}
          </span>
        )}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        {view.trendResource && <Sparkline values={history} />}
        {view.cost && (
          <span className={`${pixelClass} text-xs tabular-nums text-amber-100`}>
            {formatNumber(Math.ceil(view.cost.amount))}
          </span>
        )}
      </span>
    </button>
  );
}

/** Buttons for the decisions a universe asks the player to make by hand. */
export default function ActionPanel({ def, run, onAct }: ActionPanelProps) {
  // Actions with a panel of their own (the weather desk) are drawn there.
  const actions = visibleActions(def, run).filter((a) => !a.isInline);
  if (actions.length === 0 || run.complete) return null;
  return (
    <section aria-label="Actions" className="space-y-3">
      {actions.map((action) => {
        const view = action.describe(run);
        return (
          <ActionCard
            key={action.id}
            view={view}
            run={run}
            isDoable={canPerformAction(def, run, action.id)}
            onAct={() => onAct(action.id)}
          />
        );
      })}
    </section>
  );
}
