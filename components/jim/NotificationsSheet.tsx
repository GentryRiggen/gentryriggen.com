"use client";

import { useEffect, useId, useRef, useState } from "react";
import { LoaderCircle, X } from "lucide-react";
import type { BriefingStatus } from "@/components/jim/useMorningBriefing";
import { JimError } from "@/lib/jim/api";
import { needsHomeScreen } from "@/lib/jim/push";
import {
  getPushSettings,
  putPushSettings,
  type PushSettings,
  type PushSettingsPatch,
} from "@/lib/jim/pushSettings";

interface NotificationsSheetProps {
  open: boolean;
  onClose: () => void;
  /** This device's push subscription: the master switch. */
  status: BriefingStatus;
  onToggleMaster: () => void;
  getToken: (force?: boolean) => Promise<string | null>;
  api: string;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

const HOME_SCREEN_HINT =
  "Add Jim to your Home Screen first (Share → Add to Home Screen), then turn this on there.";
const LOAD_ERROR = "Couldn't load your notification settings.";
const SAVE_ERROR = "Couldn't save that setting. Try again in a moment.";

/** HH:MM, 17:00 to 21:45, on a quarter hour: all the server takes. */
function validEvening(value: string): boolean {
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  if (!m) return false;
  const minutes = Number(m[1]) * 60 + Number(m[2]);
  return minutes >= 17 * 60 && minutes <= 21 * 60 + 45 && minutes % 15 === 0;
}

function failure(err: unknown): string {
  if (err instanceof JimError) return SAVE_ERROR;
  return err instanceof Error && err.message ? err.message : SAVE_ERROR;
}

interface SwitchRowProps {
  label: string;
  on: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}

/** A labelled on/off switch, 44px tall to tap. */
function SwitchRow({ label, on, onChange, disabled }: SwitchRowProps) {
  return (
    <li>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={disabled}
        onClick={() => onChange(!on)}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-1 text-left text-ayu-text hover:bg-white/[0.03] disabled:opacity-60"
      >
        <span className="[overflow-wrap:anywhere]">{label}</span>
        <span
          aria-hidden="true"
          className={`flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors duration-150 ${
            on ? "bg-ayu-accent" : "bg-white/[0.12]"
          }`}
        >
          <span
            className={`size-5 rounded-full bg-ayu-bg shadow transition-transform duration-150 motion-reduce:transition-none ${
              on ? "translate-x-4" : ""
            }`}
          />
        </span>
      </button>
    </li>
  );
}

/**
 * Notifications: a master switch for this device and, when it is on, one
 * switch per kind the server offers plus the evening time. Each change
 * shows at once and is put back, with the reason, if it can't be saved.
 */
export default function NotificationsSheet({
  open,
  onClose,
  status,
  onToggleMaster,
  getToken,
  api,
}: NotificationsSheetProps) {
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [settings, setSettings] = useState<PushSettings | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);

  const showSettings = open && status === "on";
  useEffect(() => {
    if (!showSettings) return;
    let live = true;
    getPushSettings(getToken, undefined, api)
      .then((next) => {
        if (live) setSettings(next);
      })
      .catch(() => {
        if (live) setLoadFailed(true);
      });
    return () => {
      live = false;
    };
  }, [showSettings, getToken, api, reloads]);

  useEffect(() => {
    if (!open) return;
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    closeRef.current?.focus();
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      // A notice on top (turning notifications on) answers Escape first.
      if (document.querySelector("[role=alertdialog]")) return;
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
      setMessage(null);
      document.removeEventListener("keydown", onKey);
      root.style.overflow = overflow;
      if (opener && opener.isConnected) opener.focus();
    };
  }, [open, onClose]);

  /** Shows `patch` now; puts the old settings back if the server says no. */
  function save(patch: PushSettingsPatch) {
    const before = settings;
    if (!before) return;
    setMessage(null);
    setSettings({
      ...before,
      kinds: before.kinds.map((k) =>
        patch.kinds && k.id in patch.kinds ? { ...k, on: patch.kinds[k.id] } : k
      ),
      eveningTime: patch.eveningTime ?? before.eveningTime,
      lessonTime: patch.lessonTime ?? before.lessonTime,
    });
    putPushSettings(patch, getToken, undefined, api).catch((err: unknown) => {
      setMessage(failure(err));
      setSettings((now) => {
        if (!now) return before;
        // Put back only what this change touched.
        return {
          ...now,
          kinds: now.kinds.map((k) =>
            patch.kinds && k.id in patch.kinds
              ? {
                  ...k,
                  on: before.kinds.find((b) => b.id === k.id)?.on ?? k.on,
                }
              : k
          ),
          eveningTime:
            patch.eveningTime !== undefined
              ? before.eveningTime
              : now.eveningTime,
          lessonTime:
            patch.lessonTime !== undefined ? before.lessonTime : now.lessonTime,
        };
      });
    });
  }

  if (!open) return null;

  const homeScreen = needsHomeScreen();
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end lg:items-center lg:justify-center lg:p-8">
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
        className="jim-card jim-rise relative mx-auto flex max-h-[calc(var(--jim-vh,100dvh)-env(safe-area-inset-top)-1.5rem)] w-full max-w-[45rem] flex-col rounded-t-3xl! rounded-b-none! shadow-2xl! lg:max-h-[min(85vh,46rem)] lg:max-w-xl lg:rounded-3xl!"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 pt-2 pr-[max(0.75rem,env(safe-area-inset-right))] pl-[max(1.25rem,env(safe-area-inset-left))]">
          <h2
            id={titleId}
            className="text-lg font-semibold tracking-tight text-ayu-text"
          >
            Notifications
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
          <ul aria-label="This device" className="space-y-1">
            <SwitchRow
              label="Notifications on this device"
              on={status === "on"}
              onChange={onToggleMaster}
            />
          </ul>
          {homeScreen && status !== "on" && (
            <p className="mt-2 text-sm text-ayu-subtle">{HOME_SCREEN_HINT}</p>
          )}
          {status === "on" && (
            <div className="mt-3 space-y-3">
              {!loadFailed && !settings && (
                <p
                  role="status"
                  className="flex items-center gap-2 py-3 text-ayu-subtle"
                >
                  <LoaderCircle
                    aria-hidden="true"
                    className="size-4 animate-spin motion-reduce:animate-none"
                  />
                  Loading…
                </p>
              )}
              {loadFailed && !settings && (
                <p
                  role="alert"
                  className="flex flex-wrap items-center gap-x-3 text-sm text-ayu-red"
                >
                  <span>{LOAD_ERROR}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setLoadFailed(false);
                      setReloads((n) => n + 1);
                    }}
                    className="-my-1 min-h-11 font-medium underline underline-offset-2"
                  >
                    Try again
                  </button>
                </p>
              )}
              {settings && (
                <>
                  <ul aria-label="What to send" className="space-y-1">
                    {settings.kinds.map((kind) => (
                      <SwitchRow
                        key={kind.id}
                        label={kind.label}
                        on={kind.on}
                        onChange={(next) =>
                          save({ kinds: { [kind.id]: next } })
                        }
                      />
                    ))}
                  </ul>
                  <label className="flex min-h-11 items-center justify-between gap-3 px-1 text-ayu-text">
                    <span>Evening wrap at</span>
                    <input
                      type="time"
                      min="17:00"
                      max="21:45"
                      step={900}
                      value={settings.eveningTime}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (
                          validEvening(value) &&
                          value !== settings.eveningTime
                        ) {
                          save({ eveningTime: value });
                        }
                      }}
                      className="min-h-11 rounded-xl border border-white/[0.08] bg-transparent px-3 text-base text-ayu-text"
                    />
                  </label>
                  <p className="px-1 text-sm text-ayu-subtle">
                    Quiet 10 PM–6:30 AM, except reminders.
                  </p>
                </>
              )}
              {message && (
                <p role="alert" className="px-1 text-sm text-ayu-red">
                  {message}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
