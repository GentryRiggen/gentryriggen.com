"use client";

import { canPerformAction } from "@/lib/ever-onward/engine/engine";
import { TUNING } from "@/lib/ever-onward/universes/smile/tuning";
import {
  LEVEL_LABELS,
  dayKind,
  dayLine,
  isRetuning,
  isWorldOpen,
  levelActionId,
  levelCard,
  levelOf,
  realLine,
  realOf,
  tuneLeft,
  tuningTo,
} from "@/lib/ever-onward/universes/smile/world";
import useRoving from "../grow/useRoving";
import type { PanelProps } from "../../universes/types";
import PanelFrame from "../retro/PanelFrame";
import { pixelClass, retroFocusClass } from "../retro/retroStyles";

const W = TUNING.world;

/** Width classes for the bar, in tenths. */
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
 * The loudspeakers: a dial of five levels. A louder one pays more grins and
 * paints real smiles over; a quieter one pays less and lets them come back.
 * Every card shows the plus and the minus as the world stands today (a
 * festival or a gloomy week moves the numbers) and nothing says which to pick.
 */
export default function SpeakersPanel({ def, run, onAct }: PanelProps) {
  const level = levelOf(run);
  const { radioProps } = useRoving(LEVEL_LABELS.length, level);
  if (!isWorldOpen(run) || run.complete) return null;

  const retuning = isRetuning(run);
  const target = retuning ? tuningTo(run) : level;
  const real = realOf(run);
  const tenths = Math.round(real * 10);

  return (
    <PanelFrame
      label="The loudspeakers"
      title="The loudspeakers"
      icon="♪"
      tone="orange"
      status={`${Math.round(real * 100)}% real`}
      statusActive={real < 0.4}
      testId="ms-speakers"
      data={{
        "data-level": level,
        "data-retuning": retuning ? "yes" : "no",
        "data-day": dayKind(run),
        "data-real": tenths,
      }}
      result={realLine(run)}
      resultTone={real < 0.6 ? "amber" : "emerald"}
      resultTestId="ms-speakers-result"
    >
      <p
        data-testid="ms-speakers-day"
        className="font-mono text-sm font-bold text-amber-100"
      >
        {dayLine(run)}
      </p>
      <p className="font-mono text-sm text-slate-200">
        Every smile in the crowd is real or painted on. A louder voice pays more
        grins, and paints real smiles over. A quieter one pays less and lets
        them come back. Retuning takes {W.retuneSeconds} seconds.
      </p>
      <div
        role="meter"
        aria-label="Real smiles"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(real * 100)}
        className="flex h-3 w-full bg-fuchsia-300/80"
      >
        <span className={`block h-3 bg-emerald-300 ${FILL[tenths]}`} />
      </div>
      <p className="flex justify-between font-mono text-xs font-bold text-slate-200 tabular-nums">
        <span className="text-emerald-200">Real</span>
        <span className="text-fuchsia-200">Painted</span>
      </p>
      <div
        role="radiogroup"
        aria-label="Loudspeaker level"
        className="grid grid-cols-1 gap-2 sm:grid-cols-5"
      >
        {LEVEL_LABELS.map((label, i) => {
          const checked = i === target;
          const doable = canPerformAction(def, run, levelActionId(i));
          const card = levelCard(run, i);
          return (
            <button
              key={label}
              {...radioProps(i)}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-disabled={!checked && !doable}
              aria-label={`Loudspeakers: ${label}`}
              aria-describedby={`ms-level-${i}-note`}
              data-testid={`ms-level-${i}`}
              onClick={() => {
                if (!checked && doable) onAct(levelActionId(i));
              }}
              className={`${pixelClass} min-h-14 w-full touch-manipulation space-y-1.5 border-4 p-2 text-left text-[10px] ${retroFocusClass} ${
                checked
                  ? "border-orange-200 bg-orange-400 text-orange-950 shadow-[4px_4px_0_#7c2d12]"
                  : "border-slate-500 bg-slate-800 text-slate-100 shadow-[4px_4px_0_#0f172a] hover:bg-slate-700 active:translate-y-0.5 active:shadow-none"
              }`}
            >
              <span className="block">{label}</span>
              <span
                id={`ms-level-${i}-note`}
                className="block font-mono text-xs leading-snug font-bold normal-case"
              >
                <span className="block">+ {card.plus}</span>
                <span className="block">− {card.minus}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="font-mono text-xs font-bold text-amber-100 tabular-nums">
        {retuning
          ? `Retuning the loudspeakers: ${Math.ceil(tuneLeft(run))}s left, and they pay half until then.`
          : `The loudspeakers are on ${LEVEL_LABELS[level]}.`}
      </p>
    </PanelFrame>
  );
}
