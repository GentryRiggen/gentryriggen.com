"use client";

import { X } from "lucide-react";
import { PAINT_COLORS, type PaintColor } from "@/lib/ship-builder/model/paint";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { buttonClass, panelClass } from "./styles";

/**
 * Tailwind only sees complete class names, so each swatch fill is spelled out.
 * PaintBar.test.tsx checks these stay in step with PAINT_COLORS.
 */
export const SWATCH_FILL: Record<PaintColor, string> = {
  buff: "bg-[#d9b97c]",
  black: "bg-[#222222]",
  white: "bg-[#f4f4f0]",
  red: "bg-[#c8312b]",
  navy: "bg-[#1f3a6b]",
  sky: "bg-[#5aa9e0]",
  green: "bg-[#3c8d4a]",
  yellow: "bg-[#f2c744]",
  orange: "bg-[#ee8a2c]",
  pink: "bg-[#ec7fb0]",
  purple: "bg-[#7b4bb0]",
  grey: "bg-[#8a8f98]",
};

const SWATCH_BASE =
  "h-11 w-11 shrink-0 touch-manipulation rounded-full border border-slate-400 dark:border-slate-500";
const SWATCH_SELECTED =
  "ring-2 ring-sky-500 ring-offset-2 ring-offset-white dark:ring-sky-400 dark:ring-offset-slate-900";

/** Floating swatch bar, shown while the paint tool is active. */
export default function PaintBar() {
  const tool = useShipBuilderStore((s) => s.tool);
  const selectPaint = useShipBuilderStore((s) => s.selectPaint);
  const cancel = useShipBuilderStore((s) => s.cancel);

  if (tool.kind !== "paint") return null;

  // Below lg it sits under the drawer toggles instead of covering them.
  return (
    <div
      role="group"
      aria-label="Paint colours"
      className={`absolute left-1/2 top-14 z-30 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center justify-center gap-2 rounded-2xl border p-2 shadow-lg lg:top-3 ${panelClass}`}
    >
      <div className="flex flex-wrap items-center justify-center gap-2 p-1">
        {PAINT_COLORS.map(({ id, name }) => {
          const selected = tool.color === id;
          return (
            <button
              key={id}
              type="button"
              aria-label={name}
              aria-pressed={selected}
              onClick={() => selectPaint(id)}
              className={`${SWATCH_BASE} ${SWATCH_FILL[id]} ${
                selected ? SWATCH_SELECTED : ""
              }`}
            />
          );
        })}
      </div>
      <button
        type="button"
        aria-label="Close paint bar"
        onClick={cancel}
        className={`${buttonClass} h-11 w-11 shrink-0 self-start p-0!`}
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  );
}
