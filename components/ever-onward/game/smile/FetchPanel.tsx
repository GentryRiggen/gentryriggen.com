"use client";

import { canPerformAction } from "@/lib/ever-onward/engine/engine";
import { formatNumber } from "@/lib/ever-onward/engine/format";
import {
  FETCH_ACTION_ID,
  isBallReady,
  isFetchOpen,
  throwPays,
  throwsSoFar,
} from "@/lib/ever-onward/universes/smile/fetch";
import type { PanelProps } from "../../universes/types";
import PanelFrame from "../retro/PanelFrame";
import { pixelClass, retroFocusClass } from "../retro/retroStyles";

/** Fetch: the puppy brings the ball back, and a throw is a burst of smiles. */
export default function FetchPanel({ def, run, onAct }: PanelProps) {
  if (!isFetchOpen(run) || run.complete) return null;
  const ready = isBallReady(run);
  const doable = canPerformAction(def, run, FETCH_ACTION_ID);
  return (
    <PanelFrame
      label="Fetch"
      title="Fetch"
      icon="●"
      tone="amber"
      status={ready ? "The ball is back" : "Fetching"}
      statusActive={ready}
      testId="ms-fetch"
      data={{ "data-ready": ready ? "yes" : "no" }}
      result={
        throwsSoFar(run) > 0
          ? `${throwsSoFar(run)} throws so far. Good dog.`
          : ""
      }
      resultTestId="ms-fetch-result"
    >
      <button
        type="button"
        aria-disabled={!doable}
        data-testid="ms-fetch-throw"
        onClick={() => {
          if (doable) onAct(FETCH_ACTION_ID);
        }}
        className={`${pixelClass} flex min-h-11 w-full touch-manipulation items-center justify-between gap-2 border-4 px-3 py-2 text-left text-[10px] ${retroFocusClass} ${
          doable
            ? "border-amber-200 bg-amber-400 text-amber-950 shadow-[3px_3px_0_#78350f] hover:bg-amber-300 active:translate-y-0.5 active:shadow-none"
            : "cursor-not-allowed border-slate-600 bg-slate-900 text-slate-400"
        }`}
      >
        <span>{ready ? "Throw the ball" : "The puppy is fetching"}</span>
        {ready && (
          <span className="font-mono text-xs font-bold normal-case tabular-nums">
            +{formatNumber(Math.floor(throwPays(run)))} smiles
          </span>
        )}
      </button>
    </PanelFrame>
  );
}
