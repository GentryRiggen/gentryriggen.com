"use client";

import {
  hasMeter,
  heatOf,
  isTired,
  meterLine,
} from "@/lib/ever-onward/universes/smile/meter";
import type { PanelProps } from "../../universes/types";
import PanelFrame from "../retro/PanelFrame";

/** Width classes for the meter, in tenths. */
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
 * The cheer meter: how warm the crowd is. Tapping and parades warm it, rest
 * cools it, and a worn-out crowd pays less until it has rested. A bar and a
 * plain line, nothing to press: the choice is in how fast you tap.
 */
export default function CheerMeter({ run }: PanelProps) {
  if (!hasMeter(run) || run.complete) return null;
  const heat = heatOf(run);
  const tired = isTired(run);
  const level = Math.min(10, Math.round(heat * 10));
  return (
    <PanelFrame
      label="The cheer meter"
      title="Cheer meter"
      icon="♨"
      tone={tired ? "orange" : "emerald"}
      status={tired ? "Worn out" : `${Math.round(heat * 100)}%`}
      statusActive={tired || heat >= 0.7}
      testId="ms-meter"
      data={{ "data-tired": tired ? "yes" : "no", "data-heat": level }}
      result={meterLine(run)}
      resultTestId="ms-meter-result"
    >
      <div
        role="meter"
        aria-label="Cheer meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(heat * 100)}
        className="h-3 w-full bg-black/50"
      >
        <span
          className={`block h-3 ${
            tired
              ? "bg-orange-400"
              : heat >= 0.7
                ? "bg-amber-300"
                : "bg-emerald-300"
          } ${FILL[level]}`}
        />
      </div>
    </PanelFrame>
  );
}
