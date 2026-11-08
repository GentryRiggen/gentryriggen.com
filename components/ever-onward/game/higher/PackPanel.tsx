"use client";

import { canPerformAction } from "@/lib/ever-onward/engine/engine";
import {
  KEEPSAKES,
  PACK_SIZE,
  bookedLoad,
  endingWarmth,
  isCardShown,
  isSettingDown,
  keepActionId,
  keepsakeState,
  leaveActionId,
  loadEase,
  loadOf,
  nextAhead,
  slowFor,
  slowedBy,
  warmthOf,
  warmthWords,
  weightOf,
} from "@/lib/ever-onward/universes/higher/keepsakes";
import { TUNING } from "@/lib/ever-onward/universes/higher/tuning";
import type { PanelProps } from "../../universes/types";
import PanelFrame from "../retro/PanelFrame";
import { pixelClass, retroFocusClass } from "../retro/retroStyles";

/** Full class names, so Tailwind sees every one of them. */
const SLOT_FILL = ["bg-slate-700", "bg-amber-300", "bg-amber-300"] as const;

const ORIGIN_CLASS = {
  Sky: "text-sky-200",
  Town: "text-rose-200",
  Playroom: "text-amber-200",
  Grass: "text-emerald-200",
} as const;

function buttonText(state: string, canBring: boolean): string {
  if (state === "marked") return "Bringing it";
  if (state === "carried") return "Set it down";
  if (state === "left") return "Left behind";
  return canBring ? "Bring it" : "No room";
}

/**
 * What to carry (the Top's one quiet choice). Each keepsake on the stairs
 * shows what it adds to the last picture and what it costs in slower steps,
 * and none says which is better: a light pack is faster and a full one is
 * a warmer ending, and what is on the stairs depends on the run.
 */
export default function PackPanel({ def, run, onAct }: PanelProps) {
  if (run.phase !== 3 || run.complete) return null;
  const shown = KEEPSAKES.flatMap((_, i) => (isCardShown(run, i) ? [i] : []));
  const booked = bookedLoad(run);
  const carried = loadOf(run);
  const slow = Math.round(slowedBy(run) * 100);
  const ahead = nextAhead(run);
  const settingDown = isSettingDown(run);
  return (
    <PanelFrame
      label="What to carry"
      title="What to carry"
      icon="♥"
      tone="amber"
      status={`pack ${booked} of ${PACK_SIZE}`}
      statusActive={booked > 0}
      testId="bh-pack"
      data={{
        "data-load": carried,
        "data-booked": booked,
        "data-warmth": endingWarmth(run),
      }}
      result={
        settingDown
          ? "The robot has stopped to set something down."
          : ahead >= 0
            ? `Next on the stairs: ${KEEPSAKES[ahead].name.toLowerCase()}.`
            : ""
      }
      resultTestId="bh-pack-result"
      resultTone="slate"
    >
      <p className="font-mono text-xs text-slate-200">
        Little things from the build are waiting on the stairs. The robot picks
        up only what you say to bring, and the pack is small. Whatever it
        carries slows every step, and lights up the last picture.
      </p>
      <div className="flex items-center gap-2" aria-hidden="true">
        {Array.from({ length: PACK_SIZE }, (_, n) => (
          <span
            key={n}
            className={`h-3 flex-1 border-2 border-slate-500 ${
              n < carried
                ? SLOT_FILL[2]
                : n < booked
                  ? "bg-amber-300/40"
                  : SLOT_FILL[0]
            }`}
          />
        ))}
      </div>
      <p
        data-testid="bh-pack-slow"
        className="font-mono text-xs font-bold text-slate-100 tabular-nums"
      >
        {slow > 0
          ? `Steps are ${slow}% slower with this pack.`
          : "The pack is empty. Steps are full speed."}
      </p>
      <ul className="grid gap-2 sm:grid-cols-2" aria-label="The keepsakes">
        {shown.map((i) => {
          const k = KEEPSAKES[i];
          const state = keepsakeState(run, i);
          const id = keepActionId(i);
          const doable = canPerformAction(def, run, id);
          const canBring = state === "open" && doable;
          const isOn = state === "marked" || state === "carried";
          const slowPct = Math.round(slowFor(weightOf(i), loadEase(run)) * 100);
          return (
            <li
              key={k.id}
              data-testid={`bh-keep-${k.id}`}
              data-state={state}
              className={`flex flex-col gap-1.5 border-4 p-2 ${
                isOn
                  ? "border-amber-300 bg-amber-950/60 shadow-[4px_4px_0_#78350f]"
                  : state === "left"
                    ? "border-slate-700 bg-slate-900/60 opacity-70"
                    : "border-slate-600 bg-slate-900"
              }`}
            >
              <h3 className={`${pixelClass} text-[10px] text-slate-50`}>
                {k.name}
              </h3>
              <p
                className={`font-mono text-xs font-bold ${ORIGIN_CLASS[k.from]}`}
              >
                From the {k.from}
              </p>
              <p className="font-mono text-xs text-slate-200">{k.note}</p>
              <p className="font-mono text-xs font-bold text-emerald-200">
                + Adds {warmthWords(warmthOf(run, i))}
              </p>
              <p className="font-mono text-xs font-bold text-rose-200">
                - Slows steps by about {slowPct}% (weight {weightOf(i)})
              </p>
              <button
                type="button"
                aria-disabled={
                  !(
                    canBring ||
                    state === "marked" ||
                    (state === "carried" && !settingDown)
                  )
                }
                data-testid={`bh-keep-btn-${k.id}`}
                onClick={() => {
                  if (doable) onAct(id);
                }}
                className={`${pixelClass} mt-auto min-h-11 w-full touch-manipulation border-4 px-3 py-2 text-[10px] ${retroFocusClass} ${
                  doable
                    ? isOn
                      ? "border-amber-200 bg-amber-400 text-amber-950 shadow-[3px_3px_0_#78350f] hover:bg-amber-300 active:translate-y-0.5 active:shadow-none"
                      : "border-slate-300 bg-slate-700 text-slate-50 shadow-[3px_3px_0_#0f172a] hover:bg-slate-600 active:translate-y-0.5 active:shadow-none"
                    : "cursor-not-allowed border-slate-700 bg-slate-900 text-slate-400"
                }`}
              >
                {buttonText(state, canBring)}
              </button>
              {(state === "open" || state === "marked") && (
                <button
                  type="button"
                  aria-disabled={!canPerformAction(def, run, leaveActionId(i))}
                  data-testid={`bh-keep-leave-${k.id}`}
                  onClick={() => {
                    if (canPerformAction(def, run, leaveActionId(i)))
                      onAct(leaveActionId(i));
                  }}
                  className={`${pixelClass} min-h-11 w-full touch-manipulation border-4 border-slate-600 bg-slate-900 px-3 py-2 text-[10px] text-slate-200 hover:bg-slate-800 active:translate-y-0.5 ${retroFocusClass}`}
                >
                  Leave it
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="font-mono text-xs text-slate-300">
        Marked a keepsake? Unmark it any time before the robot gets there.
        Setting one down once it is carried stops the robot for{" "}
        {TUNING.top.keepsakes.setDownSeconds} sec, and the slow steps are not
        paid back.
      </p>
    </PanelFrame>
  );
}
