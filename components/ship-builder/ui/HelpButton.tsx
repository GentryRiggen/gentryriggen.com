"use client";

import { HelpCircle } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from "react";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { buttonClass, panelClass, primaryButtonClass } from "./styles";

const COACH_STORAGE_KEY = "ship-builder:ui:coach-seen";

const listeners = new Set<() => void>();
// Remembers a dismissal when localStorage is unavailable.
let isDismissedInMemory = false;

function isWebDriven(): boolean {
  return typeof navigator !== "undefined" && navigator.webdriver === true;
}

function hasSeenCoach(): boolean {
  if (isDismissedInMemory) return true;
  try {
    return window.localStorage.getItem(COACH_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function dismissCoach(): void {
  isDismissedInMemory = true;
  try {
    window.localStorage.setItem(COACH_STORAGE_KEY, "1");
  } catch {
    // Storage is unavailable; the in-memory flag covers this session.
  }
  listeners.forEach((listener) => listener());
}

/** Test-only: forget a dismissal so each test starts first-run. */
export function resetCoachForTests(): void {
  isDismissedInMemory = false;
  listeners.forEach((listener) => listener());
}

const TIPS = [
  "Tap a part in the panel, then tap the ship to place it.",
  "Press and hold a part to delete it, or select it and press Delete.",
  "Drag to turn the view. Two fingers pan and zoom (mouse: right-drag pans, wheel zooms).",
  "R rotates the part you are placing, Esc cancels, Cmd/Ctrl+Z undoes.",
];

// Bottom-left, raised above the corner buttons' row when anchored to them.
const ANCHOR_CLASS =
  "absolute bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+3.5rem)] left-3 z-20";

/** A "?" button with a gesture cheat sheet, plus a one-time first-run tip. */
export default function HelpButton() {
  const [open, setOpen] = useState(false);
  const popoverId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const toolKind = useShipBuilderStore((s) => s.tool.kind);
  const isCoachVisible = useSyncExternalStore(
    subscribe,
    () => !hasSeenCoach() && !isWebDriven(),
    () => false
  );

  // Picking a part means the tip has done its job.
  useEffect(() => {
    if (isCoachVisible && toolKind !== "none") dismissCoach();
  }, [isCoachVisible, toolKind]);

  // Tapping the ship or anywhere else closes the cheat sheet.
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape" || !open) return;
    // Keep the global Escape shortcut from also clearing the current tool.
    event.stopPropagation();
    setOpen(false);
    buttonRef.current?.focus();
  }

  return (
    <>
      <div
        ref={wrapperRef}
        onKeyDown={handleKeyDown}
        className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 z-20"
      >
        <button
          ref={buttonRef}
          type="button"
          aria-label="Help"
          aria-expanded={open}
          aria-controls={popoverId}
          onClick={() => setOpen((current) => !current)}
          className={`${buttonClass} h-11 w-11 rounded-full p-0! shadow-sm`}
        >
          <HelpCircle aria-hidden="true" className="h-5 w-5" />
        </button>
        {open && (
          <div
            id={popoverId}
            role="dialog"
            aria-label="How to build"
            className={`absolute bottom-full left-0 mb-2 w-[min(20rem,calc(100vw-1.5rem))] rounded-lg border p-3 shadow-lg ${panelClass}`}
          >
            <h2 className="mb-1 text-sm font-semibold">How to build</h2>
            <ul className="list-disc space-y-1 pl-4 text-sm text-slate-700 dark:text-slate-300">
              {TIPS.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {isCoachVisible && (
        <div
          role="note"
          className={`${ANCHOR_CLASS} flex max-w-[calc(100%-1.5rem)] items-center gap-3 rounded-lg border p-3 text-sm shadow-lg xl:left-16 xl:bottom-[max(0.75rem,env(safe-area-inset-bottom))] xl:max-w-xs ${panelClass}`}
        >
          <p>Pick a part on the left, then tap the ship to place it.</p>
          <button
            type="button"
            onClick={dismissCoach}
            className={`${primaryButtonClass} min-h-11 shrink-0`}
          >
            Got it
          </button>
        </div>
      )}
    </>
  );
}
