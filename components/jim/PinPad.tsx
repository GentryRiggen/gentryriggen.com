"use client";

import { useEffect, useRef } from "react";
import { ArrowRight, Delete } from "lucide-react";
import { PIN_MAX, PIN_MIN } from "@/lib/jim/appLock";

interface PinPadProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  /** The submit key's name ("OK", "Next"). */
  submitLabel: string;
  disabled?: boolean;
  /** Bump to shake the dots (a wrong PIN). */
  shake?: number;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

const KEY_CLASS =
  "flex size-[4.5rem] [@media(max-height:640px)]:size-16 items-center justify-center rounded-full text-2xl font-medium text-ayu-text transition-colors duration-150 select-none touch-manipulation disabled:opacity-40";

/**
 * A large numeric keypad with dots for the digits entered: no system
 * keyboard (and so no autofill or keyboard history). A hardware keyboard
 * works too: digits, Backspace, Enter.
 */
export default function PinPad({
  value,
  onChange,
  onSubmit,
  submitLabel,
  disabled = false,
  shake = 0,
}: PinPadProps) {
  // The latest props, for the one keydown listener.
  const latest = useRef({ value, onChange, onSubmit, disabled });
  const padRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    latest.current = { value, onChange, onSubmit, disabled };
  });

  function press(digit: string) {
    if (disabled || value.length >= PIN_MAX) return;
    onChange(value + digit);
  }

  function erase() {
    if (disabled) return;
    onChange(value.slice(0, -1));
  }

  const canSubmit = !disabled && value.length >= PIN_MIN;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const now = latest.current;
      if (now.disabled || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const target = event.target;
      // Leave Enter on a button outside the pad (Forgot PIN?, Close) alone;
      // on a key of the pad it submits, not presses that key again.
      if (
        event.key === "Enter" &&
        target instanceof HTMLButtonElement &&
        !padRef.current?.contains(target)
      ) {
        return;
      }
      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        if (now.value.length < PIN_MAX) now.onChange(now.value + event.key);
      } else if (event.key === "Backspace") {
        event.preventDefault();
        now.onChange(now.value.slice(0, -1));
      } else if (event.key === "Enter") {
        event.preventDefault();
        if (now.value.length >= PIN_MIN) now.onSubmit();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const dots = Math.max(PIN_MIN, value.length);

  return (
    <div ref={padRef} className="flex flex-col items-center gap-6">
      <div
        key={shake}
        role="img"
        aria-label={`${value.length} ${value.length === 1 ? "digit" : "digits"} entered`}
        className={`flex h-4 items-center gap-3.5 ${shake > 0 ? "jim-shake" : ""}`}
      >
        {Array.from({ length: dots }, (_, i) => (
          <span
            key={i}
            className={`size-3.5 rounded-full border transition-colors duration-150 ${
              i < value.length
                ? "border-ayu-accent bg-ayu-accent"
                : "border-ayu-subtle/60 bg-transparent"
            }`}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-x-6 gap-y-3.5 [@media(max-height:640px)]:gap-y-2.5">
        {KEYS.map((digit) => (
          <button
            key={digit}
            type="button"
            disabled={disabled}
            onClick={() => press(digit)}
            className={`${KEY_CLASS} jim-card rounded-full! hover:bg-ayu-raised active:bg-ayu-raised`}
          >
            {digit}
          </button>
        ))}
        <button
          type="button"
          aria-label="Delete"
          disabled={disabled || value.length === 0}
          onClick={erase}
          className={`${KEY_CLASS} text-ayu-subtle hover:text-ayu-text`}
        >
          <Delete aria-hidden="true" className="size-6" />
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => press("0")}
          className={`${KEY_CLASS} jim-card rounded-full! hover:bg-ayu-raised active:bg-ayu-raised`}
        >
          0
        </button>
        <button
          type="button"
          aria-label={submitLabel}
          disabled={!canSubmit}
          onClick={onSubmit}
          className={`${KEY_CLASS} ${
            canSubmit
              ? "jim-glow text-ayu-bg"
              : "bg-white/[0.06] text-ayu-subtle"
          }`}
        >
          <ArrowRight aria-hidden="true" className="size-6" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
