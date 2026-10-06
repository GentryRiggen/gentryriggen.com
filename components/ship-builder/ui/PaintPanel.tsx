"use client";

import { PAINT_COLORS, type PaintColor } from "@/lib/ship-builder/model/paint";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";

interface PaintPanelProps {
  /** Called after a colour is picked. */
  onPick?: () => void;
}

/**
 * Tailwind only sees complete class names, so each swatch fill is spelled out.
 * PaintPanel.test.tsx checks these stay in step with PAINT_COLORS.
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
  oak: "bg-[#9a6b3f]",
  "dark-oak": "bg-[#5a3a22]",
  weathered: "bg-[#8b8479]",
};

const SWATCH_BASE =
  "h-11 w-11 shrink-0 touch-manipulation rounded-full border border-slate-400 dark:border-slate-500";
const SWATCH_SELECTED =
  "ring-2 ring-sky-500 ring-offset-2 ring-offset-white dark:ring-sky-400 dark:ring-offset-slate-900";

/** The colour grid shown in the Parts panel while painting. */
export default function PaintPanel({ onPick }: PaintPanelProps) {
  const tool = useShipBuilderStore((s) => s.tool);
  const selectPaint = useShipBuilderStore((s) => s.selectPaint);
  const current = tool.kind === "paint" ? tool.color : null;

  return (
    <div className="space-y-3 p-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Tap a part or the hull to paint it. Tap it again with the same colour to
        wash the paint off.
      </p>
      <div role="group" aria-label="Paint colours">
        <ul className="grid grid-cols-3 gap-2">
          {PAINT_COLORS.map(({ id, name }) => (
            <li key={id} className="flex flex-col items-center gap-1 py-1">
              <button
                type="button"
                aria-label={name}
                aria-pressed={current === id}
                onClick={() => {
                  selectPaint(id);
                  onPick?.();
                }}
                className={`${SWATCH_BASE} ${SWATCH_FILL[id]} ${
                  current === id ? SWATCH_SELECTED : ""
                }`}
              />
              <span
                aria-hidden="true"
                className="text-xs text-slate-600 dark:text-slate-300"
              >
                {name}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
