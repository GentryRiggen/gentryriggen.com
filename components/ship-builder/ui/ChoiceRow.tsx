"use client";

import type { LucideIcon } from "lucide-react";
import { useId, useRef, type KeyboardEvent } from "react";

interface ChoiceRowOption<T> {
  value: T;
  label: string;
  Icon: LucideIcon;
}

interface ChoiceRowProps<T> {
  /**
   * The row's name, read as the group's name: shown above it as a `row`,
   * only read out as a `pill`.
   */
  label: string;
  options: readonly ChoiceRowOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** A line under the row, read as the group's description (`row` only). */
  help?: string;
  /**
   * `row` (the default) is a setup card row: a label over an even grid.
   * `pill` is a compact rounded strip with no visible label, sized to its
   * options (the running trial's Speed switch).
   */
  variant?: "row" | "pill";
}

const OPTION_CLASS =
  "flex min-h-11 min-w-0 touch-manipulation items-center justify-center gap-1 rounded-lg px-1.5 py-1 text-center text-xs font-medium leading-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 sm:text-sm dark:focus-visible:outline-sky-400";

const PILL_OPTION_CLASS =
  "inline-flex min-h-11 shrink-0 touch-manipulation items-center justify-center gap-0.5 rounded-full px-1.5 text-sm sm:gap-1 sm:px-2.5 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:focus-visible:outline-sky-400";

const PRESSED_CLASS =
  "bg-white text-sky-800 shadow-sm dark:bg-slate-950 dark:text-sky-200";

const UNPRESSED_CLASS =
  "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white";

const COLUMNS: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
};

/**
 * A segmented choice, every option an icon plus a word: one row of a trial
 * setup card (a label over the choice), or a compact `pill`. Only the picked
 * option is a Tab stop; the arrow keys move the pick along the row
 * (wrapping), Home and End jump.
 */
export default function ChoiceRow<T extends string | number>({
  label,
  options,
  value,
  onChange,
  help,
  variant = "row",
}: ChoiceRowProps<T>) {
  const labelId = useId();
  const helpId = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const current = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  );

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const last = options.length - 1;
    const moves: Record<string, number> = {
      ArrowRight: current >= last ? 0 : current + 1,
      ArrowDown: current >= last ? 0 : current + 1,
      ArrowLeft: current <= 0 ? last : current - 1,
      ArrowUp: current <= 0 ? last : current - 1,
      Home: 0,
      End: last,
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    const next = moves[event.key];
    onChange(options[next].value);
    buttons.current[next]?.focus();
  }

  const isPill = variant === "pill";
  const buttonList = options.map((option, index) => {
    const isPressed = index === current;
    return (
      <button
        key={String(option.value)}
        ref={(node) => {
          buttons.current[index] = node;
        }}
        type="button"
        aria-pressed={isPressed}
        tabIndex={isPressed ? 0 : -1}
        onClick={() => onChange(option.value)}
        className={`${isPill ? PILL_OPTION_CLASS : OPTION_CLASS} ${isPressed ? PRESSED_CLASS : UNPRESSED_CLASS}`}
      >
        <option.Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span className="min-w-0">{option.label}</span>
      </button>
    );
  });

  if (isPill) {
    return (
      <div
        role="group"
        aria-label={label}
        onKeyDown={handleKeyDown}
        className="inline-flex max-w-full rounded-full border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-800"
      >
        {buttonList}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span
        id={labelId}
        className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
      >
        {label}
      </span>
      <div
        role="group"
        aria-labelledby={labelId}
        aria-describedby={help ? helpId : undefined}
        onKeyDown={handleKeyDown}
        className={`grid ${COLUMNS[options.length] ?? "grid-flow-col"} gap-0.5 rounded-xl border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-800`}
      >
        {buttonList}
      </div>
      {help && (
        <p id={helpId} className="text-xs text-slate-600 dark:text-slate-400">
          {help}
        </p>
      )}
    </div>
  );
}
