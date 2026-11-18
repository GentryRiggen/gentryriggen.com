import { useEffect, useState, type ReactNode } from "react";
import { CODE_ALPHABET, CODE_LENGTH } from "@/lib/flamelings/online/card";
import { DISPLAY, FOCUS_RING } from "../styles";

/**
 * A QWERTY layout with the number row on top, on a 20-column grid so each
 * key spans two columns and the lower rows can sit half a key in. Keys a
 * code never uses (look-alikes O, I, L, 0, 1) are still there, so the
 * keyboard looks whole, but tapping one wiggles it and says so.
 */
const KEY_ROWS = ["1234567890", "QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];

/** Literal classes (Tailwind cannot see built ones): row r, key i. */
const ROW_START_CLASS: string[][] = [
  [
    "col-start-1",
    "col-start-3",
    "col-start-5",
    "col-start-7",
    "col-start-9",
    "col-start-11",
    "col-start-13",
    "col-start-15",
    "col-start-17",
    "col-start-19",
  ],
  [
    "col-start-1",
    "col-start-3",
    "col-start-5",
    "col-start-7",
    "col-start-9",
    "col-start-11",
    "col-start-13",
    "col-start-15",
    "col-start-17",
    "col-start-19",
  ],
  [
    "col-start-2",
    "col-start-4",
    "col-start-6",
    "col-start-8",
    "col-start-10",
    "col-start-12",
    "col-start-14",
    "col-start-16",
    "col-start-18",
  ],
  [
    "col-start-3",
    "col-start-5",
    "col-start-7",
    "col-start-9",
    "col-start-11",
    "col-start-13",
    "col-start-15",
  ],
];

const KEY = `${DISPLAY} grid h-14 min-w-0 place-items-center rounded-2xl text-2xl font-semibold transition-transform active:translate-y-[3px] disabled:opacity-40 disabled:active:translate-y-0 sm:h-20 sm:text-4xl ${FOCUS_RING}`;

/** How long the "codes never use O" note stays up. */
const NOPE_MS = 3500;

interface CodeKeypadProps {
  value: string;
  onChange: (next: string) => void;
  /** Shown between the typed letters and the keys (a preview or a hint). */
  children?: ReactNode;
  /** Hides the keys, for when the code is complete and being checked. */
  hideKeys?: boolean;
}

/**
 * A big on-screen keyboard (QWERTY, numbers on top) that only types the
 * letters and digits a friend code can hold (no system keyboard).
 */
export default function CodeKeypad({
  value,
  onChange,
  children,
  hideKeys = false,
}: CodeKeypadProps) {
  const full = value.length >= CODE_LENGTH;
  // A look-alike key (O, I, L, 0, 1) was tapped: it wiggles and a note says
  // codes never use it. `n` restarts the wiggle on every tap.
  const [nope, setNope] = useState<{ ch: string; n: number } | null>(null);
  useEffect(() => {
    if (!nope) return;
    const id = window.setTimeout(() => setNope(null), NOPE_MS);
    return () => window.clearTimeout(id);
  }, [nope]);
  return (
    <div className="flex w-full max-w-3xl flex-col items-center gap-3">
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
      <p
        role="status"
        data-testid="keypad-nope"
        className={`min-h-7 text-center text-lg font-extrabold leading-tight text-[#7a3d2c] dark:text-[#ffe6c4] ${
          nope ? "" : "invisible"
        }`}
      >
        {nope && `Friend codes never use ${nope.ch}. Look again!`}
      </p>
      {!hideKeys && (
        <div
          role="group"
          aria-label="Letters and numbers"
          data-testid="keypad-keys"
          className="grid w-full grid-cols-20 gap-x-1 gap-y-2 sm:gap-x-1.5 sm:gap-y-3"
        >
          {KEY_ROWS.map((row, r) =>
            [...row].map((ch, i) => {
              const usable = CODE_ALPHABET.includes(ch);
              const shaking = !usable && nope?.ch === ch;
              return (
                <button
                  key={shaking ? `${ch}-${nope.n}` : ch}
                  type="button"
                  disabled={full}
                  onClick={() =>
                    usable
                      ? onChange(value + ch)
                      : setNope((was) => ({ ch, n: (was?.n ?? 0) + 1 }))
                  }
                  aria-label={ch}
                  data-testid={`key-${ch}`}
                  className={`${KEY} ${ROW_START_CLASS[r][i]} col-span-2 bg-[#fff6e6] text-[#3a2340] shadow-[0_4px_0_#e7c9a3,0_6px_14px_rgba(30,10,40,.22)] active:shadow-[0_1px_0_#e7c9a3] ${
                    shaking ? "fl-headshake" : ""
                  }`}
                >
                  {ch}
                </button>
              );
            })
          )}
          <button
            type="button"
            disabled={value.length === 0}
            onClick={() => onChange(value.slice(0, -1))}
            aria-label="Delete the last letter"
            data-testid="key-delete"
            className={`${KEY} col-span-3 col-start-18 bg-[#ffd9b0] shadow-[0_4px_0_#e0a46a,0_6px_14px_rgba(30,10,40,.2)] active:shadow-[0_1px_0_#e0a46a]`}
          >
            <span aria-hidden="true" className="text-[#9a4a10]">
              ⌫
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
