import type { ReactNode } from "react";
import { CODE_ALPHABET, CODE_LENGTH } from "@/lib/flamelings/online/card";
import { FOCUS_RING } from "../styles";

interface CodeKeypadProps {
  value: string;
  onChange: (next: string) => void;
  /** Shown between the typed letters and the keys (a preview or a hint). */
  children?: ReactNode;
  /** Hides the keys, for when the code is complete and being checked. */
  hideKeys?: boolean;
}

/**
 * A big on-screen keypad with only the letters and digits a friend code can
 * hold (no system keyboard, no way to type anything else).
 */
export default function CodeKeypad({
  value,
  onChange,
  children,
  hideKeys = false,
}: CodeKeypadProps) {
  const full = value.length >= CODE_LENGTH;
  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-3">
      <p
        data-testid="keypad-slots"
        aria-label={`Code typed so far: ${value || "nothing"}`}
        role="img"
        className="flex gap-2"
      >
        {Array.from({ length: CODE_LENGTH }, (_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={`grid size-12 place-items-center rounded-2xl border-4 text-3xl font-black sm:size-16 sm:text-4xl ${
              i === value.length
                ? "border-orange-500 bg-white dark:border-orange-300 dark:bg-slate-700"
                : "border-stone-300 bg-white dark:border-slate-600 dark:bg-slate-800"
            }`}
          >
            {value[i] ?? ""}
          </span>
        ))}
      </p>
      {children}
      {!hideKeys && (
        <div
          role="group"
          aria-label="Letters and numbers"
          className="grid w-full grid-cols-6 gap-1.5 sm:grid-cols-8 sm:gap-2"
        >
          {[...CODE_ALPHABET].map((ch) => (
            <button
              key={ch}
              type="button"
              disabled={full}
              onClick={() => onChange(value + ch)}
              aria-label={ch}
              data-testid={`key-${ch}`}
              className={`min-h-14 rounded-2xl bg-white text-2xl font-black text-stone-900 shadow-md transition-transform active:scale-90 disabled:opacity-40 disabled:active:scale-100 sm:min-h-16 dark:bg-slate-700 dark:text-amber-50 ${FOCUS_RING}`}
            >
              {ch}
            </button>
          ))}
          <button
            type="button"
            disabled={value.length === 0}
            onClick={() => onChange(value.slice(0, -1))}
            aria-label="Delete the last letter"
            data-testid="key-delete"
            className={`min-h-14 rounded-2xl bg-orange-200 text-2xl font-black text-stone-900 shadow-md transition-transform active:scale-90 disabled:opacity-40 disabled:active:scale-100 sm:min-h-16 dark:bg-orange-300 ${FOCUS_RING}`}
          >
            <span aria-hidden="true">⌫</span>
          </button>
        </div>
      )}
    </div>
  );
}
