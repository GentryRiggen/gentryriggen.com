"use client";

import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { TOO_MANY_NOTICE, countdown } from "@/components/jim/LockScreen";
import PinPad from "@/components/jim/PinPad";
import type { AppLock } from "@/components/jim/useAppLock";
import { LOCK_AFTER_CHOICES, PIN_MIN, pinSupported } from "@/lib/jim/appLock";

interface AppLockSheetProps {
  lock: AppLock;
  open: boolean;
  onClose: () => void;
  /** Signs out and wipes this device's Jim data (too many wrong PINs). */
  onWipe: (notice: string) => void;
}

/** What the current PIN unlocks, once it is entered. */
type Guarded = "change" | "after" | "off" | "faceOn" | "faceOff";

type Step =
  | { kind: "menu" }
  | { kind: "verify"; then: Guarded }
  | { kind: "new"; change: boolean }
  | { kind: "confirm"; change: boolean; first: string }
  /** Choosing "Lock after": with `pin`, the last step of turning it on. */
  | { kind: "after"; pin?: string }
  | { kind: "face" };

export function afterLabel(seconds: number): string {
  return (
    LOCK_AFTER_CHOICES.find((c) => c.seconds === seconds)?.label ??
    "Immediately"
  );
}

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

const ROW =
  "flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-3.5 text-left text-base text-ayu-text hover:bg-white/[0.06]";

const PRIMARY =
  "jim-glow min-h-12 w-full rounded-xl px-4 font-semibold text-ayu-bg hover:brightness-110 disabled:opacity-50";

/**
 * The app lock's settings, a sheet from the bottom. Off: choose a PIN
 * (twice), when it locks, then Face ID if this device has it. On: lock now,
 * and the settings, each behind the current PIN.
 */
export default function AppLockSheet({
  lock,
  open,
  onClose,
  onWipe,
}: AppLockSheetProps) {
  if (!open) return null;
  return <Sheet lock={lock} onClose={onClose} onWipe={onWipe} />;
}

function Sheet({ lock, onClose, onWipe }: Omit<AppLockSheetProps, "open">) {
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [step, setStep] = useState<Step>(() =>
    lock.enabled ? { kind: "menu" } : { kind: "new", change: false }
  );
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [after, setAfterChoice] = useState(lock.after);
  const supported = pinSupported();

  useEffect(() => {
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    closeRef.current?.focus();
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const sheet = sheetRef.current;
      const all = [...(sheet?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
      if (!sheet || all.length === 0) return;
      const first = all[0];
      const last = all[all.length - 1];
      const at = document.activeElement;
      if (!sheet.contains(at)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && at === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && at === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      root.style.overflow = overflow;
      if (opener?.isConnected) opener.focus();
    };
  }, [onClose]);

  function go(next: Step, note: string | null = null) {
    setPin("");
    setMessage(note);
    setStep(next);
  }

  function wrong(note: string) {
    setPin("");
    setShake((s) => s + 1);
    setMessage(note);
  }

  async function verifyCurrent(then: Guarded) {
    setBusy(true);
    const result = await lock.verify(pin);
    setBusy(false);
    switch (result.kind) {
      case "ok":
        if (then === "change") go({ kind: "new", change: true });
        else if (then === "after") {
          setAfterChoice(lock.after);
          go({ kind: "after" });
        } else if (then === "off") {
          lock.turnOff();
          onClose();
        } else if (then === "faceOn") go({ kind: "face" });
        else {
          lock.disableFaceId();
          go({ kind: "menu" }, "Face ID is off.");
        }
        break;
      case "wrong":
        wrong(
          `Wrong PIN. ${result.attemptsLeft} ${
            result.attemptsLeft === 1 ? "attempt" : "attempts"
          } left.`
        );
        break;
      case "wait":
        wrong(
          `Too many wrong PINs. Try again in ${countdown(result.until - Date.now())}.`
        );
        break;
      case "wipe":
        onWipe(TOO_MANY_NOTICE);
        break;
      case "missing":
        onClose();
        break;
    }
  }

  async function finish(newPin: string, change: boolean) {
    setBusy(true);
    try {
      if (change) {
        const saved = await lock.changePin(newPin);
        go(
          { kind: "menu" },
          saved ? "PIN changed." : "Couldn't save the PIN on this device."
        );
      } else {
        const saved = await lock.turnOn(newPin, after);
        if (!saved)
          go(
            { kind: "new", change: false },
            "Couldn't save the PIN on this device."
          );
        else if (lock.faceIdSupported) go({ kind: "face" }, "App lock is on.");
        else onClose();
      }
    } catch {
      setMessage("This browser can't set a PIN here.");
    } finally {
      setBusy(false);
    }
  }

  function submitPin() {
    if (busy || pin.length < PIN_MIN) return;
    switch (step.kind) {
      case "verify":
        void verifyCurrent(step.then);
        break;
      case "new":
        go({ kind: "confirm", change: step.change, first: pin });
        break;
      case "confirm":
        if (pin !== step.first) {
          setStep({ kind: "new", change: step.change });
          wrong("The PINs didn't match. Choose it again.");
        } else if (step.change) void finish(pin, true);
        else go({ kind: "after", pin });
        break;
      default:
        break;
    }
  }

  async function enableFaceId() {
    setBusy(true);
    const on = await lock.enableFaceId();
    setBusy(false);
    if (on) {
      go({ kind: "menu" }, "Face ID is on.");
    } else {
      setMessage("Face ID wasn't set up. Try again, or use your PIN.");
    }
  }

  function saveAfter() {
    if (step.kind !== "after") return;
    if (step.pin !== undefined) {
      void finish(step.pin, false);
      return;
    }
    lock.setAfter(after);
    go({ kind: "menu" }, `Locks after: ${afterLabel(after)}.`);
  }

  const pinPrompt =
    step.kind === "verify"
      ? "Enter your current PIN"
      : step.kind === "new"
        ? `Choose a ${step.change ? "new " : ""}PIN (4 to 8 digits)`
        : step.kind === "confirm"
          ? "Enter it again"
          : null;

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="jim-card jim-rise relative mx-auto flex max-h-[calc(var(--jim-vh,100dvh)-env(safe-area-inset-top)-1.5rem)] w-full max-w-[45rem] flex-col rounded-t-3xl! rounded-b-none! shadow-2xl!"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 pt-2 pr-[max(0.75rem,env(safe-area-inset-right))] pl-[max(1.25rem,env(safe-area-inset-left))]">
          <h2
            id={titleId}
            className="text-lg font-semibold tracking-tight text-ayu-text"
          >
            App lock
          </h2>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex size-11 items-center justify-center rounded-full text-ayu-subtle hover:bg-white/[0.06] hover:text-ayu-text"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-[max(1rem,env(safe-area-inset-left))] pt-1 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <p
            role="status"
            className={`min-h-5 pb-2 text-center text-sm ${
              message &&
              /^(Wrong|The PINs|Too many|Couldn't|Face ID wasn't|This browser)/.test(
                message
              )
                ? "text-ayu-red"
                : "text-ayu-subtle"
            }`}
          >
            {message}
          </p>

          {!supported && !lock.enabled ? (
            <p className="py-6 text-center text-ayu-subtle">
              This browser can&apos;t set a PIN here.
            </p>
          ) : pinPrompt !== null ? (
            <div className="flex flex-col items-center gap-4 pb-2">
              <p className="text-base font-medium text-ayu-text">{pinPrompt}</p>
              <PinPad
                value={pin}
                onChange={setPin}
                onSubmit={submitPin}
                submitLabel={step.kind === "verify" ? "OK" : "Next"}
                disabled={busy}
                shake={shake}
              />
            </div>
          ) : step.kind === "after" ? (
            <div className="space-y-4">
              <fieldset>
                <legend className="mb-2 px-1 text-base font-medium text-ayu-text">
                  Lock after
                </legend>
                <p className="mb-2 px-1 text-sm text-ayu-subtle">
                  How long you can be away from Jim before he asks for the PIN.
                </p>
                <div className="space-y-1">
                  {LOCK_AFTER_CHOICES.map((choice) => (
                    <label
                      key={choice.seconds}
                      className={`${ROW} cursor-pointer`}
                    >
                      <span>
                        {choice.label}
                        {choice.seconds === 0 && (
                          <span className="block text-xs text-ayu-subtle">
                            As soon as you leave the app
                          </span>
                        )}
                      </span>
                      <input
                        type="radio"
                        name="jim-lock-after"
                        value={choice.seconds}
                        checked={after === choice.seconds}
                        onChange={() => setAfterChoice(choice.seconds)}
                        className="size-5 accent-[var(--color-ayu-accent)]"
                      />
                    </label>
                  ))}
                </div>
              </fieldset>
              <button
                type="button"
                disabled={busy}
                onClick={saveAfter}
                className={PRIMARY}
              >
                {step.pin !== undefined ? "Turn on" : "Save"}
              </button>
            </div>
          ) : step.kind === "face" ? (
            <div className="space-y-3 pb-2 text-center">
              <p className="text-base font-medium text-ayu-text">
                Unlock with Face ID?
              </p>
              <p className="text-sm text-ayu-subtle">
                Your PIN still works, and is still needed to change these
                settings.
              </p>
              <p className="rounded-xl border border-ayu-accent/25 bg-ayu-accent/10 px-3 py-2 text-left text-sm text-ayu-accent">
                iOS lets the phone&apos;s passcode stand in for Face ID; anyone
                who knows your phone passcode can then open Jim.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void enableFaceId()}
                className={PRIMARY}
              >
                Use Face ID
              </button>
              <button
                type="button"
                onClick={onClose}
                className="min-h-11 w-full px-4 text-ayu-subtle hover:text-ayu-text"
              >
                Not now
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  lock.lockNow();
                }}
                className={`${PRIMARY} mb-2`}
              >
                Lock now
              </button>
              <button
                type="button"
                onClick={() => go({ kind: "verify", then: "after" })}
                className={ROW}
              >
                <span>Lock after</span>
                <span className="text-ayu-subtle">
                  {afterLabel(lock.after)}
                </span>
              </button>
              <button
                type="button"
                onClick={() => go({ kind: "verify", then: "change" })}
                className={ROW}
              >
                Change PIN
              </button>
              {(lock.faceIdSupported || lock.faceId) && (
                <button
                  type="button"
                  onClick={() =>
                    go({
                      kind: "verify",
                      then: lock.faceId ? "faceOff" : "faceOn",
                    })
                  }
                  className={ROW}
                >
                  <span>Face ID</span>
                  <span className="text-ayu-subtle">
                    {lock.faceId ? "On" : "Off"}
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={() => go({ kind: "verify", then: "off" })}
                className={`${ROW} text-ayu-red!`}
              >
                Turn off app lock
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
