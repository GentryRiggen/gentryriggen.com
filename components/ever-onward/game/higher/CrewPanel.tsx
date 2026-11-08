"use client";

import { useState } from "react";
import { canPerformAction } from "@/lib/ever-onward/engine/engine";
import { FOREMEN, pairNotes } from "@/lib/ever-onward/universes/higher/foremen";
import {
  HATS,
  foremanActionId,
  hatIds,
  hatWait,
  isHired,
  isTownOpen,
  pendingIds,
} from "@/lib/ever-onward/universes/higher/town";
import { TUNING } from "@/lib/ever-onward/universes/higher/tuning";
import type { PanelProps } from "../../universes/types";
import PanelFrame from "../retro/PanelFrame";
import { pixelClass, retroFocusClass } from "../retro/retroStyles";
import useRoving from "../grow/useRoving";
import { HAT_BG } from "./HatBits";

const nameOf = (id: number): string =>
  FOREMEN.find((f) => f.id === id)?.name ?? "Nobody";

/**
 * Foremen's hats: three hats and six foremen, each with a plus and a minus.
 * Pick a hat, then pick a foreman for it. A swap takes a whole shift, and the
 * hat stands with the site's regular foreman until the new one arrives. The
 * cards show the plus and the minus, who gets on with whom, and never say who
 * is best: the set of three is the choice.
 */
export default function CrewPanel({ def, run, onAct }: PanelProps) {
  const [hat, setHat] = useState(0);
  const worn = hatIds(run);
  const coming = pendingIds(run);
  const { radioProps } = useRoving(HATS, hat);
  if (!isTownOpen(run)) return null;
  const waiting = coming.filter((id) => id > 0).length;
  return (
    <PanelFrame
      label="The foremen's hats"
      title="Foremen's hats"
      icon="/"
      tone="amber"
      status={waiting > 0 ? `${waiting} on the way` : "all hats on"}
      statusActive={waiting > 0}
      testId="bh-crew"
      data={{ "data-crew": worn.join(""), "data-waiting": waiting }}
    >
      <div
        role="radiogroup"
        aria-label="Which hat to change"
        className="grid grid-cols-3 gap-2"
      >
        {Array.from({ length: HATS }, (_, h) => {
          const wait = hatWait(run, h);
          const id = worn[h] || coming[h];
          return (
            <button
              key={h}
              {...radioProps(h)}
              type="button"
              role="radio"
              aria-checked={h === hat}
              aria-label={`Hat ${h + 1}`}
              data-testid={`bh-hat-${h}`}
              data-foreman={worn[h]}
              onClick={() => setHat(h)}
              className={`${pixelClass} min-h-14 touch-manipulation space-y-1 border-4 p-2 text-left text-[10px] ${retroFocusClass} ${
                h === hat
                  ? "border-amber-200 bg-amber-950 text-amber-100"
                  : "border-slate-500 bg-slate-800 text-slate-100 hover:bg-slate-700"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={`inline-block h-3 w-4 border-2 border-black/60 ${HAT_BG[worn[h]] ?? HAT_BG[0]}`}
                />
                Hat {h + 1}
              </span>
              <span className="block font-mono text-xs leading-snug font-bold normal-case">
                {wait > 0
                  ? `${nameOf(id)} in ${wait} sec`
                  : worn[h]
                    ? nameOf(worn[h])
                    : "Regular foreman"}
              </span>
            </button>
          );
        })}
      </div>
      <p className="font-mono text-xs text-slate-300">
        Changing a hat takes a whole shift ({TUNING.town.shiftSeconds} sec). The
        old foreman leaves right away and the hat waits for the new one. A
        waiting hat has the regular foreman: plain pay, no plus and no minus.
      </p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {FOREMEN.map((f) => {
          const hired = isHired(run, f.id);
          const doable = canPerformAction(def, run, foremanActionId(hat, f.id));
          const notes = pairNotes(f);
          return (
            <li key={f.id}>
              <button
                type="button"
                aria-disabled={!doable}
                data-testid={`bh-foreman-${f.id}`}
                onClick={() => {
                  if (doable) onAct(foremanActionId(hat, f.id));
                }}
                className={`${pixelClass} min-h-11 w-full touch-manipulation space-y-1.5 border-4 p-2 text-left text-[10px] ${retroFocusClass} ${
                  doable
                    ? "border-amber-300 bg-slate-800 text-slate-100 shadow-[3px_3px_0_#78350f] hover:bg-slate-700 active:translate-y-0.5 active:shadow-none"
                    : "cursor-not-allowed border-slate-600 bg-slate-900 text-slate-400"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className={`inline-block h-3 w-4 border-2 border-black/60 ${HAT_BG[f.id]}`}
                  />
                  {f.name}
                  {hired && (
                    <span className="ml-auto text-[10px] text-amber-300">
                      on a hat
                    </span>
                  )}
                </span>
                <span className="block font-mono text-xs leading-snug font-bold normal-case">
                  <span className="block text-emerald-300">+ {f.plus}</span>
                  <span className="block text-rose-300">- {f.minus}</span>
                  {notes.likes && (
                    <span className="block font-normal text-sky-200">
                      {notes.likes}
                    </span>
                  )}
                  {notes.clashes && (
                    <span className="block font-normal text-orange-200">
                      {notes.clashes}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </PanelFrame>
  );
}
