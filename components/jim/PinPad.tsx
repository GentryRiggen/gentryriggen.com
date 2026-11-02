"use client";

import { useEffect, useId, useRef } from "react";
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

/** Digits only, at most PIN_MAX of them. */
export function pinDigits(text: string): string {
  return text.replace(/\D/g, "").slice(0, PIN_MAX);
}

/** Buttons whose own Enter is kept (Forgot PIN?, Cancel, Close). */
export const KEEP_ENTER = { "data-pin-keep-enter": "" } as const;

/**
 * A large numeric keypad with dots for the digits entered. Behind the dots
 * is a hidden numeric box: tapping them opens the phone's number pad, and on
 * a desktop it has focus from the start. A hardware keyboard works anywhere:
 * digits, Backspace, and Enter, which submits wherever focus is, except on a
 * button marked with KEEP_ENTER.
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
  const boxRef = useRef<HTMLInputElement>(null);
  const countId = useId();
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
      // The box takes its own keys (once each).
      if (target === boxRef.current) return;
      if (event.key === "Enter") {
        const outside =
          target instanceof HTMLElement && !padRef.current?.contains(target);
        // Forgot PIN?, Cancel, Close: their own Enter.
        if (outside && target.closest("[data-pin-keep-enter]")) return;
        // With nothing to submit, a button outside the pad (Face ID) works
        // as a button; on a key of the pad Enter never presses it again.
        if (
          now.value.length < PIN_MIN &&
          outside &&
          (target instanceof HTMLButtonElement ||
            target instanceof HTMLAnchorElement)
        ) {
          return;
        }
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

  // A desktop types straight in; a phone waits for a tap on the dots, so
  // its keyboard doesn't cover the keypad unasked.
  useEffect(() => {
    if (window.matchMedia?.("(pointer: fine)")?.matches) {
      boxRef.current?.focus({ preventScroll: true });
    }
  }, []);

  function typed(text: string) {
    if (disabled) return;
    const next = pinDigits(text);
    if (next !== value) onChange(next);
  }

  const dots = Math.max(PIN_MIN, value.length);

  return (
    <div ref={padRef} className="flex flex-col items-center gap-6">
      <div className="relative flex min-h-11 min-w-44 items-center justify-center">
        {/* Plain text, never type=password (a password manager would offer
            to save it as a login), with no name, id or form, and the
            managers told to look away; invisible, the dots show it.
            Read-only (not disabled) while busy, so the phone keyboard stays
            up between tries. */}
        <input
          ref={boxRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="go"
          maxLength={PIN_MAX}
          aria-label="PIN"
          aria-describedby={countId}
          data-1p-ignore=""
          data-lpignore="true"
          data-form-type="other"
          readOnly={disabled}
          value={value}
          onChange={(event) => typed(event.target.value)}
          onPaste={(event) => {
            event.preventDefault();
            const box = event.currentTarget;
            const start = box.selectionStart ?? value.length;
            const end = box.selectionEnd ?? value.length;
            typed(
              value.slice(0, start) +
                event.clipboardData.getData("text") +
                value.slice(end)
            );
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            if (canSubmit) onSubmit();
          }}
          className="peer absolute inset-0 z-10 size-full cursor-pointer rounded-full bg-transparent text-base text-transparent caret-transparent opacity-0 outline-none select-none"
        />
        <span id={countId} className="sr-only">
          {`${value.length} ${value.length === 1 ? "digit" : "digits"} entered`}
        </span>
        <div
          key={shake}
          aria-hidden="true"
          className={`flex h-4 items-center gap-3.5 rounded-full outline-offset-[0.6rem] peer-focus-visible:outline-2 peer-focus-visible:outline-ayu-accent ${shake > 0 ? "jim-shake" : ""}`}
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
