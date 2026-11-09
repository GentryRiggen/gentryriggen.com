"use client";

import { memo } from "react";
import { canPerformAction } from "@/lib/ever-onward/engine/engine";
import { formatNumber } from "@/lib/ever-onward/engine/format";
import {
  CHILL_NAMES,
  LIGHTS,
  WIND_KINDS,
  burnPips,
  chillForecast,
  chillIn,
  chillLeft,
  chillKind,
  chillSize,
  companyPips,
  isBitten,
  isCarried,
  isChillBlowing,
  isLit,
  isTired,
  letGoActionId,
  litCount,
  lockLeft,
  lumpNow,
} from "@/lib/ever-onward/universes/light/warmth";
import type { PanelProps } from "../universes/types";
import PanelFrame from "./retro/PanelFrame";
import { pixelClass, retroFocusClass } from "./retro/retroStyles";

const PIPS = 5;

/** Five small marks: filled for how much, so the card is a look, never a sum. Screen readers get "3 of 5". */
function Pips({
  count,
  fill,
  glyph,
  label,
}: {
  count: number;
  fill: string;
  glyph: string;
  label: string;
}) {
  return (
    <span
      role="img"
      aria-label={`${label}: ${count} of ${PIPS}`}
      className="flex gap-0.5"
    >
      {Array.from({ length: PIPS }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`font-mono text-sm leading-none ${i < count ? fill : "text-slate-700"}`}
        >
          {glyph}
        </span>
      ))}
    </span>
  );
}

/** The names of the lights still burning that the wind bites, in words ("the stadium lights and the tower windows"). */
function bittenNames(run: PanelProps["run"]): string {
  const names = LIGHTS.filter((_, i) => isLit(run, i) && isBitten(run, i)).map(
    (light) => light.name.toLowerCase()
  );
  if (names.length === 0) return "nothing left to bite";
  if (names.length === 1) return `the ${names[0]}`;
  return `the ${names.slice(0, -1).join(", the ")} and the ${names[names.length - 1]}`;
}

/** The cold wind in words: its size and kind, which lights it bites, blowing or coming (with a rough time) or still. */
function windLine(run: PanelProps["run"]): string {
  const kind = WIND_KINDS[chillKind(run)].name;
  if (isChillBlowing(run))
    return `A ${CHILL_NAMES[chillSize(run)]} ${kind} is blowing for about ${Math.max(5, Math.round(chillLeft(run) / 5) * 5)} s. It bites ${bittenNames(run)}: they burn harder, and a goodbye the wind carries pays more.`;
  const coming = chillForecast(run);
  if (coming !== null)
    return `A ${CHILL_NAMES[coming]} ${kind} is coming in about ${Math.max(5, Math.round(chillIn(run) / 5) * 5)} s. It will bite ${bittenNames(run)}.`;
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
            const isHit = isBitten(run, i);
            const isLifted = isCarried(run, i);
            return (
              <li
                key={light.id}
                data-testid={`lm-light-${i}`}
                data-bitten={isHit ? "yes" : "no"}
                className={`min-w-0 space-y-1.5 border-2 p-2 ${
                  isHit
                    ? "border-sky-300 bg-sky-950/60"
                    : "border-slate-600 bg-slate-900/80"
                }`}
              >
                <p className="font-mono text-xs font-bold leading-tight text-amber-100">
                  {light.name}
                </p>
                {isTired(run, i) && (
                  <p
                    data-testid={`lm-tired-${i}`}
                    className="font-mono text-[10px] font-bold leading-tight text-amber-300"
                  >
                    Getting tired
                  </p>
                )}
                {isHit && (
                  <p
                    data-testid={`lm-bitten-${i}`}
                    className="font-mono text-[10px] font-bold leading-tight text-sky-200"
                  >
                    {isChillBlowing(run)
                      ? "The wind bites it"
                      : "Wind will bite it"}
                  </p>
                )}
                <p className="flex items-center justify-between gap-1 font-mono text-[10px] text-slate-300">
                  <span>Costs warmth</span>
                  <Pips
                    count={burn}
                    fill="text-orange-400"
                    glyph="▲"
                    label="Costs warmth"
                  />
                </p>
                <p className="flex items-center justify-between gap-1 font-mono text-[10px] text-slate-300">
                  <span>Keeps company</span>
                  <Pips
                    count={company}
                    fill="text-rose-400"
                    glyph="♥"
                    label="Keeps company"
                  />
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
                  <span>{isLifted ? "Let go on the wind" : "Let go"}</span>
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
