"use client";

import { memo } from "react";
import { canPerformAction } from "@/lib/ever-onward/engine/engine";
import { formatNumber } from "@/lib/ever-onward/engine/format";
import {
  chosenSide,
  forkActionId,
  forkOf,
  forkPreview,
  isForkShown,
  type ForkSide,
} from "@/lib/ever-onward/universes/light/forks";
import type { PanelProps } from "../universes/types";
import PanelFrame, { type PanelTone } from "./retro/PanelFrame";
import { pixelClass, retroFocusClass } from "./retro/retroStyles";

const TONES: readonly PanelTone[] = ["orange", "sky", "violet", "lime"];

function SideCard({
  side,
  chosen,
  preview,
  isDoable,
  currencyHave,
  onChoose,
}: {
  side: ForkSide;
  chosen: ForkSide | null;
  preview: string;
  isDoable: boolean;
  currencyHave: number;
  onChoose: () => void;
}) {
  const isMine = chosen?.id === side.id;
  const isClosed = chosen !== null && !isMine;
  const id = `lm-fork-${side.id}`;
  return (
    <li
      data-testid={id}
      data-state={isMine ? "yours" : isClosed ? "closed" : "open"}
      className={`flex flex-col gap-2 border-4 p-3 ${
        isMine
          ? "border-emerald-300 bg-emerald-950/50 shadow-[4px_4px_0_#064e3b]"
          : isClosed
            ? "border-slate-800 bg-slate-950/60 opacity-60"
            : "border-amber-300 bg-slate-900/80 shadow-[4px_4px_0_#78350f]"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className={`${pixelClass} text-[10px] text-amber-100`}>
          {side.name}
        </h3>
        <span
          className={`${pixelClass} border-2 px-1.5 py-1 text-[10px] ${
            isMine
              ? "border-emerald-300 bg-emerald-950 text-emerald-100"
              : "border-slate-600 bg-slate-900 text-slate-200"
          }`}
        >
          {isMine ? "Yours" : isClosed ? "Closed" : side.tagline}
        </span>
      </div>
      <p className="font-mono text-xs text-slate-300 italic">{side.wry}</p>
      <p id={`${id}-gives`} className="font-mono text-sm text-slate-100">
        {side.gives}
      </p>
      {!isClosed && (
        <p className="font-mono text-sm font-bold text-emerald-200 tabular-nums">
          {preview}
        </p>
      )}
      <p id={`${id}-catch`} className="font-mono text-xs text-amber-200">
        The catch: {side.catches}
      </p>
      {chosen === null && (
        <button
          type="button"
          aria-disabled={!isDoable}
          aria-describedby={`${id}-gives ${id}-catch`}
          data-testid={`${id}-choose`}
          onClick={() => {
            if (isDoable) onChoose();
          }}
          className={`mt-auto flex w-full touch-manipulation items-center justify-between gap-2 border-4 px-3 py-2 text-left transition-transform aria-disabled:cursor-not-allowed ${retroFocusClass} ${
            isDoable
              ? "border-amber-200 bg-amber-400 text-amber-950 shadow-[3px_3px_0_#78350f] hover:bg-amber-300 active:translate-y-0.5 active:shadow-none"
              : "border-slate-600 bg-slate-900 text-slate-400"
          }`}
        >
          <span className={`${pixelClass} text-[10px]`}>
            {isDoable ? "Choose" : "Saving up"}
          </span>
          <span className="font-mono text-xs font-bold tabular-nums">
            {formatNumber(side.price)}
            {!isDoable && ` (${formatNumber(Math.floor(currencyHave))} so far)`}
          </span>
        </button>
      )}
    </li>
  );
}

/**
 * A fork in the road: two cards, and only one can be had this run. Each
 * says what it gives, what it costs besides the price, and (wryly) what it
 * is like. Once one is chosen the other closes and the picture changes.
 */
function ForkPanel({ def, run, onAct }: PanelProps) {
  const fork = forkOf(run);
  if (!fork || run.complete || !isForkShown(run)) return null;
  const chosen = chosenSide(run, fork);
  const have = run.resources[fork.currency] ?? 0;
  const tone = TONES[Math.min(TONES.length - 1, fork.phase)];

  return (
    <PanelFrame
      label={fork.title}
      title={fork.title}
      icon="Y"
      tone={tone}
      status={chosen ? `You chose: ${chosen.name}` : "Pick one"}
      statusActive={chosen === null}
      testId="lm-fork"
      data={{ "data-fork": fork.id, "data-chosen": chosen?.id }}
      result={
        chosen ? `${chosen.name}. The other way is closed for this run.` : ""
      }
      resultTestId="lm-fork-result"
      resultTone="amber"
    >
      <p className="font-mono text-sm text-slate-200">{fork.question}</p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {fork.sides.map((side) => (
          <SideCard
            key={side.id}
            side={side}
            chosen={chosen}
            preview={chosen ? "" : forkPreview(run, fork, side.id)}
            isDoable={canPerformAction(def, run, forkActionId(side.id))}
            currencyHave={have}
            onChoose={() => onAct(forkActionId(side.id))}
          />
        ))}
      </ul>
    </PanelFrame>
  );
}

export default memo(ForkPanel);
