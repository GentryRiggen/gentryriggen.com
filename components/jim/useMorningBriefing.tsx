"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { JimMenuItem } from "@/components/jim/JimHeader";
import {
  currentSubscription,
  disablePush,
  enablePush,
  isIos,
  needsHomeScreen,
  pushSupported,
} from "@/lib/jim/push";

type GetToken = (force?: boolean) => Promise<string | null>;

/** hidden: no push in this browser (and not an iPhone that could have it). */
type Status = "hidden" | "off" | "on";

export const BRIEFING_MESSAGES = {
  homeScreen:
    "Add Jim to your Home Screen first (Share → Add to Home Screen), then turn this on there.",
  deniedIos:
    "Notifications are off for Jim. Turn them on in Settings → Notifications → Jim, then try again.",
  denied:
    "Notifications are blocked for this site. Allow them in your browser's site settings, then try again.",
  failed: "Couldn't turn on the morning briefing. Try again in a moment.",
  on: "Morning briefing is on. A test notification is on its way.",
};

function initialStatus(): Status {
  if (needsHomeScreen()) return "off";
  return pushSupported() ? "off" : "hidden";
}

interface NoticeProps {
  message: string;
  onClose: () => void;
}

/** A small centered notice with one OK. */
function Notice({ message, onClose }: NoticeProps) {
  const textId = useId();
  const okRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    okRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-[max(1rem,env(safe-area-inset-left))]">
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label="Morning briefing"
        aria-describedby={textId}
        className="jim-card jim-rise relative w-full max-w-sm space-y-4 rounded-3xl! p-5 shadow-2xl!"
      >
        <p id={textId} className="text-base text-ayu-text">
          {message}
        </p>
        <div className="flex justify-end">
          <button
            ref={okRef}
            type="button"
            onClick={onClose}
            className="jim-glow min-h-11 min-w-20 rounded-full px-5 font-semibold text-ayu-bg hover:brightness-110"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The "Morning briefing: On/Off" menu entry and the notice it may raise.
 * The entry reflects this device's push subscription; turning it on asks
 * for permission straight from the tap (iOS only allows it there).
 */
export default function useMorningBriefing(
  getToken: GetToken,
  api: string
): { item: JimMenuItem | null; notice: ReactNode } {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [message, setMessage] = useState<string | null>(null);
  const busy = useRef(false);
  /** Where focus was before the notice, to go back to after. */
  const returnTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (needsHomeScreen() || !pushSupported()) return;
    let cancelled = false;
    void currentSubscription().then((sub) => {
      if (!cancelled) setStatus(sub ? "on" : "off");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const show = useCallback((text: string) => {
    returnTo.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setMessage(text);
  }, []);

  const close = useCallback(() => {
    setMessage(null);
    returnTo.current?.focus();
    returnTo.current = null;
  }, []);

  const toggle = useCallback(() => {
    if (needsHomeScreen()) {
      show(BRIEFING_MESSAGES.homeScreen);
      return;
    }
    if (busy.current) return;
    busy.current = true;
    if (status === "on") {
      void disablePush(getToken, undefined, api).finally(() => {
        busy.current = false;
        setStatus("off");
      });
      return;
    }
    // No await before this call: the permission prompt needs the tap.
    void enablePush(getToken, undefined, api).then((result) => {
      busy.current = false;
      if (result.ok) {
        setStatus("on");
        show(BRIEFING_MESSAGES.on);
      } else if (result.reason === "denied") {
        show(isIos() ? BRIEFING_MESSAGES.deniedIos : BRIEFING_MESSAGES.denied);
      } else if (result.reason === "home-screen") {
        show(BRIEFING_MESSAGES.homeScreen);
      } else if (result.reason === "unsupported") {
        setStatus("hidden");
      } else if (result.reason === "failed") {
        show(BRIEFING_MESSAGES.failed);
      }
    });
  }, [api, getToken, show, status]);

  return {
    item:
      status === "hidden"
        ? null
        : {
            label: `Morning briefing: ${status === "on" ? "On" : "Off"}`,
            onSelect: toggle,
          },
    notice: message ? <Notice message={message} onClose={close} /> : null,
  };
}
