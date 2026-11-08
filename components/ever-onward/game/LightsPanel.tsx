"use client";

import { memo } from "react";
import { canPerformAction } from "@/lib/ever-onward/engine/engine";
import { formatNumber } from "@/lib/ever-onward/engine/format";
import {
  CHILL_NAMES,
  LIGHTS,
  burnPips,
  chillForecast,
  chillIn,
  chillLeft,
  chillSize,
  companyPips,
  isChillBlowing,
  isLit,
  letGoActionId,
  litCount,
  lockLeft,
  lumpNow,
} from "@/lib/ever-onward/universes/light/warmth";
import type { PanelProps } from "../universes/types";
import PanelFrame from "./retro/PanelFrame";
import { pixelClass, retroFocusClass } from "./retro/retroStyles";

const PIPS = 5;

/** Five small marks: filled for how much, so the card is a look, never a sum. */
function Pips({
  count,
  fill,
  glyph,
}: {
  count: number;
  fill: string;
  glyph: string;
}) {
  return (
    <span aria-hidden="true" className="flex gap-0.5">
      {Array.from({ length: PIPS }, (_, i) => (
        <span
          key={i}
          className={`font-mono text-sm leading-none ${i < count ? fill : "text-slate-700"}`}
        >
          {glyph}
        </span>
      ))}
    </span>
  );
}

/** The cold wind in words: blowing, coming (with a rough time) or still. */
function windLine(run: PanelProps["run"]): string {
  if (isChillBlowing(run))
    return `A ${CHILL_NAMES[chillSize(run)]} wind is blowing. Every light burns harder for about ${Math.max(5, Math.round(chillLeft(run) / 5) * 5)} s.`;
  const coming = chillForecast(run);
  if (coming !== null)
    return `A ${CHILL_NAMES[coming]} wind is coming in about ${Math.max(5, Math.round(chillIn(run) / 5) * 5)} s.`;
  return "The air is still.";
}

/**
 * The remembered lights: every one still burning, with what it costs and what
 * it gives. The warmth it costs is shown as flames and the company it keeps
 * you (resolve a second) as hearts, never as a number to divide. Letting one
 * go is the quiet choice of the part: it pays a lump of resolve and leaves a
 * flower, and the next light waits a moment while this one rises.
 */
function LightsPanel({ def, run, onAct }: PanelProps) {
  if (run.phase !== 3 || run.complete) return null;
  const lit = litCount(run);
  const lock = Math.ceil(lockLeft(run));
  const isWindy = isChillBlowing(run) || chillForecast(run) !== null;

  return (
    <PanelFrame
      label="Remembered lights"
      title="Remembered Lights"
      icon="✦"
      tone="amber"
      status={`${lit} burning`}
      statusActive={lit > 0}
      testId="lm-lights"
      data={{ "data-lit": lit }}
    >
      <p
        data-testid="lm-wind"
        data-windy={isWindy ? "yes" : "no"}
        className={`border-2 p-2 font-mono text-xs leading-snug ${
          isWindy
            ? "border-sky-300 bg-sky-950/70 text-sky-100"
            : "border-slate-600 bg-slate-900/80 text-slate-300"
        }`}
      >
        {windLine(run)}
      </p>
      {lit === 0 ? (
        <p className="font-mono text-xs text-slate-300">
          Every light has gone. One old lantern is left, and a boat to bring
          home.
        </p>
      ) : (
        <ul
          aria-label="Lights still burning"
          className="grid grid-cols-2 gap-2"
        >
          {LIGHTS.map((light, i) => {
            if (!isLit(run, i)) return null;
            const id = letGoActionId(i);
            const doable = canPerformAction(def, run, id);
            const burn = burnPips(run, i);
            const company = companyPips(run, i);
            return (
              <li
                key={light.id}
                data-testid={`lm-light-${i}`}
                className="min-w-0 space-y-1.5 border-2 border-slate-600 bg-slate-900/80 p-2"
              >
                <p className="font-mono text-xs font-bold leading-tight text-amber-100">
                  {light.name}
                </p>
                <p className="flex items-center justify-between gap-1 font-mono text-[10px] text-slate-300">
                  <span>Costs warmth</span>
                  <Pips count={burn} fill="text-orange-400" glyph="▲" />
                  <span className="sr-only">{`${burn} of ${PIPS}`}</span>
                </p>
                <p className="flex items-center justify-between gap-1 font-mono text-[10px] text-slate-300">
                  <span>Keeps company</span>
                  <Pips count={company} fill="text-rose-400" glyph="♥" />
                  <span className="sr-only">{`${company} of ${PIPS}`}</span>
                </p>
                <button
                  type="button"
                  data-testid={`lm-letgo-${i}`}
                  aria-disabled={!doable}
                  aria-label={`Let the ${light.name.toLowerCase()} go`}
                  onClick={() => {
                    if (doable) onAct(id);
                  }}
                  className={`${pixelClass} flex min-h-11 w-full touch-manipulation flex-col items-center justify-center gap-0.5 border-4 px-2 py-1 text-[10px] transition-transform ${retroFocusClass} ${
                    doable
                      ? "border-amber-200 bg-amber-400 text-amber-950 shadow-[3px_3px_0_#78350f] hover:bg-amber-300 active:translate-y-0.5 active:shadow-none"
                      : "cursor-default border-slate-600 bg-slate-800 text-slate-400 shadow-[3px_3px_0_#0f172a]"
                  }`}
                >
                  <span>Let go</span>
                  <span className="font-mono text-[10px] font-bold normal-case">
                    {doable
                      ? `+${formatNumber(Math.max(1, Math.round(lumpNow(run, i))))} resolve`
                      : "rising…"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p
        data-testid="lm-lights-note"
        className="font-mono text-xs text-slate-300"
      >
        {lock > 0
          ? `A light is rising. The next one can go in about ${lock} s.`
          : "Each light you let go leaves a flower. A light takes a moment to rise."}
      </p>
    </PanelFrame>
  );
}

export default memo(LightsPanel);
