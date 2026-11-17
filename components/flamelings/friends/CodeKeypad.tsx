import type { ReactNode } from "react";
import { CODE_ALPHABET, CODE_LENGTH } from "@/lib/flamelings/online/card";
import { DISPLAY, PEACH_BUTTON, STICKER_BUTTON } from "../styles";

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
            className={`${DISPLAY} grid h-14 w-12 place-items-center rounded-2xl bg-[#fff6e6] text-4xl font-bold text-[#3a2340] shadow-[0_4px_0_#e7c9a3] sm:h-20 sm:w-16 sm:text-5xl ${
              i === value.length
                ? "ring-4 ring-[#f2542d]"
                : value[i]
                  ? ""
                  : "opacity-70"
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
          className="grid w-full justify-items-center gap-x-1 gap-y-2.5 [grid-template-columns:repeat(auto-fill,minmax(4rem,1fr))] sm:gap-x-2 sm:gap-y-3"
        >
          {[...CODE_ALPHABET].map((ch) => (
            <button
              key={ch}
              type="button"
              disabled={full}
              onClick={() => onChange(value + ch)}
              aria-label={ch}
              data-testid={`key-${ch}`}
              className={`${STICKER_BUTTON} ${DISPLAY} size-16 text-3xl font-semibold`}
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
            className={`${PEACH_BUTTON} size-16`}
          >
            <span aria-hidden="true" className="text-3xl text-[#9a4a10]">
              ⌫
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
