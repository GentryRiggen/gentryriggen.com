"use client";

import { ChevronsRight, FastForward, Play } from "lucide-react";
import { useRef, type KeyboardEvent } from "react";
import useTrialSpeed, {
  TRIAL_SPEEDS,
  type TrialSpeed,
} from "../hooks/useTrialSpeed";

const ICONS = { 1: Play, 2: FastForward, 3: ChevronsRight } as const;

const OPTION_CLASS =
  "inline-flex min-h-11 touch-manipulation items-center justify-center gap-1 rounded-full px-2.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:focus-visible:outline-sky-400";

const PRESSED_CLASS =
  "bg-white text-sky-800 shadow-sm dark:bg-slate-950 dark:text-sky-200";

const UNPRESSED_CLASS =
  "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white";

/** Picks how fast the trial plays: 1x, 2x or 3x. Never changes the outcome. */
export default function TrialSpeedSwitch() {
  const { speed, setSpeed } = useTrialSpeed();
  const buttons = useRef<Partial<Record<TrialSpeed, HTMLButtonElement>>>({});

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (step === 0) return;
    event.preventDefault();
    const count = TRIAL_SPEEDS.length;
    const index = TRIAL_SPEEDS.indexOf(speed);
    const next = TRIAL_SPEEDS[(index + step + count) % count];
    setSpeed(next);
    buttons.current[next]?.focus();
  }

  return (
    <div
      role="group"
      aria-label="Speed"
      onKeyDown={handleKeyDown}
      className="inline-flex rounded-full border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-800"
    >
      {TRIAL_SPEEDS.map((option) => {
        const Icon = ICONS[option];
        const isPressed = option === speed;
        return (
          <button
            key={option}
            ref={(node) => {
              if (node) buttons.current[option] = node;
            }}
            type="button"
            aria-pressed={isPressed}
            onClick={() => setSpeed(option)}
            className={`${OPTION_CLASS} ${isPressed ? PRESSED_CLASS : UNPRESSED_CLASS}`}
          >
            <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
            {option}x
          </button>
        );
      })}
    </div>
  );
}
