"use client";

import { useId } from "react";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { BREAK_MODE_OPTIONS } from "./seaTrialText";

const OPTION_CLASS =
  "inline-flex min-h-11 touch-manipulation items-center justify-center rounded-full px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:focus-visible:outline-sky-400";

const PRESSED_CLASS =
  "bg-white text-sky-800 shadow-sm dark:bg-slate-950 dark:text-sky-200";

const UNPRESSED_CLASS =
  "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white";

/**
 * Picks how an iceberg trial may break the ship: as the build decides, always
 * in two, or never. The choice lasts for the session.
 */
export default function BreakModeSwitch() {
  const breakMode = useShipBuilderStore((s) => s.breakMode);
  const setBreakMode = useShipBuilderStore((s) => s.setBreakMode);
  const helpId = useId();
  const current =
    BREAK_MODE_OPTIONS.find((option) => option.mode === breakMode) ??
    BREAK_MODE_OPTIONS[0];

  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <div
        role="group"
        aria-label="How she breaks"
        aria-describedby={helpId}
        className="inline-flex rounded-full border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-800"
      >
        {BREAK_MODE_OPTIONS.map((option) => {
          const isPressed = option.mode === breakMode;
          return (
            <button
              key={option.mode}
              type="button"
              aria-pressed={isPressed}
              onClick={() => setBreakMode(option.mode)}
              className={`${OPTION_CLASS} ${isPressed ? PRESSED_CLASS : UNPRESSED_CLASS}`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <p id={helpId} className="text-xs text-slate-600 dark:text-slate-400">
        {current.help}
      </p>
    </div>
  );
}
