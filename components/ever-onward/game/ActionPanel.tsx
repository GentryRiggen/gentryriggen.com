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
import { focusRingClass } from "../styles";

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
  good: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-200",
  bad: "bg-red-100 text-red-900 dark:bg-red-900/50 dark:text-red-200",
  neutral: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
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
      className="h-6 w-16 shrink-0 text-amber-600 dark:text-amber-400"
      aria-hidden="true"
      data-testid="lm-sparkline"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
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
      className={`flex w-full touch-manipulation items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors aria-disabled:cursor-not-allowed ${focusRingClass} ${
        isDoable
          ? "border-sky-400 bg-sky-50 text-slate-900 hover:bg-sky-100 dark:border-sky-500 dark:bg-sky-950/40 dark:text-sky-50 dark:hover:bg-sky-950/70"
          : "border-slate-200 bg-white text-slate-600 opacity-80 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
      }`}
    >
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{view.label}</span>
          {view.hint && (
            <span
              data-testid="lm-action-hint"
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TONES[view.hint.tone]}`}
            >
              {view.hint.text}
            </span>
          )}
        </span>
        {view.detail && (
          <span className="mt-0.5 block text-sm tabular-nums">
            {view.detail}
          </span>
        )}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        {view.trendResource && <Sparkline values={history} />}
        {view.cost && (
          <span className="text-sm font-semibold tabular-nums">
            {formatNumber(Math.ceil(view.cost.amount))}
          </span>
        )}
      </span>
    </button>
  );
}

/** Buttons for the decisions a universe asks the player to make by hand. */
export default function ActionPanel({ def, run, onAct }: ActionPanelProps) {
  const actions = visibleActions(def, run);
  if (actions.length === 0 || run.complete) return null;
  return (
    <section aria-label="Actions" className="space-y-2">
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
