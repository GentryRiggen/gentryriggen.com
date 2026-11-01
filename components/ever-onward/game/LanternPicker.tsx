"use client";

import { pixelClass, retroFocusClass } from "./retro/retroStyles";

/**
 * The lantern colours on offer: a name (so the choice never rests on colour
 * alone) and the swatch classes that draw it.
 */
const LANTERNS = [
  {
    name: "Gold",
    swatch: "bg-amber-300 shadow-[0_0_14px_rgba(252,211,77,0.8)]",
  },
  {
    name: "Sea",
    swatch: "bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.8)]",
  },
  {
    name: "Rose",
    swatch: "bg-rose-300 shadow-[0_0_14px_rgba(253,164,175,0.8)]",
  },
] as const;

interface LanternPickerProps {
  /** The picked lantern, 1 to 3. */
  value: number;
  onChange: (lantern: number) => void;
}

/**
 * Pick the colour of a lantern for the very last ship. Kept on this device
 * in the save, never sent anywhere, and no words to type.
 */
export default function LanternPicker({ value, onChange }: LanternPickerProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Lantern colour"
      data-testid="lm-lantern-picker"
      className="space-y-3"
    >
      <p className="font-mono text-sm text-slate-200">
        Pick a lantern. Someday, a little boat will carry it home.
      </p>
      <div className="flex justify-center gap-3">
        {LANTERNS.map((lantern, i) => {
          const isPicked = value === i + 1;
          return (
            <button
              key={lantern.name}
              type="button"
              role="radio"
              aria-checked={isPicked}
              onClick={() => onChange(i + 1)}
              className={`flex min-h-11 min-w-20 touch-manipulation flex-col items-center gap-2 border-4 p-2 ${retroFocusClass} ${
                isPicked
                  ? "border-amber-300 bg-amber-950/60"
                  : "border-slate-600 bg-slate-900 hover:bg-slate-800"
              }`}
            >
              <span
                aria-hidden="true"
                className={`block size-8 rounded-full ${lantern.swatch}`}
              />
              <span
                className={`${pixelClass} text-[8px] ${
                  isPicked ? "text-amber-300" : "text-slate-200"
                }`}
              >
                {lantern.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
