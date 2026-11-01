"use client";

import { useEffect, useState } from "react";
import { ScanFace } from "lucide-react";
import JimMark from "@/components/jim/JimMark";
import PinPad from "@/components/jim/PinPad";
import type { AppLock } from "@/components/jim/useAppLock";
import { PIN_MIN } from "@/lib/jim/appLock";

interface LockScreenProps {
  lock: AppLock;
  /** Signs out and wipes this device's Jim data, saying `notice` after. */
  onWipe: (notice: string) => void;
}

export const TOO_MANY_NOTICE =
  "Too many wrong PINs. You're signed out and this device's Jim data is wiped.";
export const FORGOT_NOTICE =
  "You're signed out and this device's Jim data is wiped. Sign in to set a new PIN.";

/** 27_000 → "0:27". */
export function countdown(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * The app lock's screen: over everything, on its own (the app behind it is
 * not drawn at all). The PIN on a big keypad, or Face ID when it is set up.
 */
export default function LockScreen({ lock, onWipe }: LockScreenProps) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [forgot, setForgot] = useState(false);

  const waitMs = lock.lockedUntil - now;
  const waiting = waitMs > 0;
  const canFace = lock.faceId && lock.faceIdSupported;

  const { settleWait } = lock;
  useEffect(() => settleWait(), [settleWait]);

  // The countdown ticks while there is a wait.
  useEffect(() => {
    if (lock.lockedUntil <= Date.now()) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [lock.lockedUntil]);

  async function submit() {
    if (busy || waiting || pin.length < PIN_MIN) return;
    setBusy(true);
    setMessage(null);
    const result = await lock.unlockWithPin(pin);
    setPin("");
    setBusy(false);
    setNow(Date.now());
    switch (result.kind) {
      case "wrong": {
        const left = result.attemptsLeft;
        setShake((s) => s + 1);
        setMessage(
          `Wrong PIN. ${left} ${left === 1 ? "attempt" : "attempts"} left.`
        );
        break;
      }
      case "wipe":
        onWipe(TOO_MANY_NOTICE);
        break;
      default:
        break;
    }
  }

  /**
   * Face ID, only from a tap: iOS wants one, and a prompt nobody asked for
   * is a nuisance. A cancel or failure leaves the PIN, and counts for nothing.
   */
  async function faceId() {
    if (busy) return;
    setBusy(true);
    const ok = await lock.unlockWithFaceId();
    setBusy(false);
    if (!ok) setMessage("Face ID didn't unlock. Use your PIN.");
  }

  return (
    <main
      aria-label="Jim is locked"
      className="jim-app fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-ayu-bg text-ayu-text"
    >
      <div className="flex min-h-full flex-col items-center justify-center gap-5 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center [@media(max-height:640px)]:gap-3">
        <JimMark size="lg" />
        {forgot ? (
          <div className="jim-rise flex max-w-sm flex-col items-center gap-4">
            <h1 className="text-2xl font-semibold tracking-tight">
              Forgot your PIN?
            </h1>
            <p className="text-ayu-subtle">
              Signing out wipes this device&apos;s Jim data: the chat kept here,
              Notes and the lock. Then sign in with your password and set a new
              PIN.
            </p>
            <button
              type="button"
              onClick={() => onWipe(FORGOT_NOTICE)}
              className="min-h-12 w-full rounded-xl border border-ayu-red/30 bg-ayu-red/10 px-4 font-semibold text-ayu-red hover:bg-ayu-red/15"
            >
              Sign out and wipe
            </button>
            <button
              type="button"
              onClick={() => setForgot(false)}
              className="min-h-11 px-4 text-ayu-subtle hover:text-ayu-text"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">Enter PIN</h1>
            <p
              role="status"
              className={`min-h-5 text-sm ${
                message?.startsWith("Wrong")
                  ? "text-ayu-red"
                  : "text-ayu-subtle"
              }`}
            >
              {waiting
                ? `${message ?? "Too many wrong PINs."} Try again in ${countdown(waitMs)}.`
                : message}
            </p>
            {canFace && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void faceId()}
                className="jim-glow flex min-h-12 items-center gap-2 rounded-full px-6 font-semibold text-ayu-bg hover:brightness-110 disabled:opacity-50"
              >
                <ScanFace aria-hidden="true" className="size-5" />
                Unlock with Face ID
              </button>
            )}
            <PinPad
              value={pin}
              onChange={(next) => {
                setPin(next);
                if (message) setMessage(null);
              }}
              onSubmit={() => void submit()}
              submitLabel="OK"
              disabled={busy || waiting}
              shake={shake}
            />
            <button
              type="button"
              onClick={() => setForgot(true)}
              className="min-h-11 px-4 text-sm text-ayu-subtle underline-offset-2 hover:text-ayu-text hover:underline"
            >
              Forgot PIN?
            </button>
          </>
        )}
      </div>
    </main>
  );
}
