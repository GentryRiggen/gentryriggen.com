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
import { createStoredSetting } from "../hooks/createStoredSetting";
import { buttonClass, panelClass, primaryButtonClass } from "./styles";

const coachSetting = createStoredSetting<boolean>({
  key: "ship-builder:ui:coach-seen",
  parse: (raw) => raw === "1",
  serialize: (value) => (value ? "1" : null),
  fallback: false,
});

function isWebDriven(): boolean {
  return typeof navigator !== "undefined" && navigator.webdriver === true;
}

function dismissCoach(): void {
  coachSetting.set(true);
}

/** Test-only: forget a dismissal so each test starts first-run. */
export function resetCoachForTests(): void {
  coachSetting.resetMemory();
}

const TIPS = [
  "Tap a part in the panel, then tap the ship to place it.",
  "Press and hold a part to delete it, or select it and press Delete.",
  "Drag to turn the view. Two fingers pan and zoom (mouse: right-drag pans, wheel zooms).",
  "R rotates the part you are placing, Esc cancels, Cmd/Ctrl+Z undoes.",
  "Driving: arrow keys or W, A, S, D steer and set the throttle, Space stops, Esc ends the drive.",
  "Pirate ships sail on wind: more sail means more speed. Tap a cannon to fire it.",
  "Walking: tap Walk and pick where to start (front, middle or back), then drag to look and use the stick to walk (or W, A, S, D to walk and the arrows to turn). Space or the jump button leaps up onto roofs and over deck chairs, and stairs lead up too. Esc stops walking.",
];

// Bottom-left, raised above the corner buttons' row when anchored to them.
const ANCHOR_CLASS =
  "absolute bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+7rem)] left-3 z-20";

/** A "?" button with a gesture cheat sheet, plus a one-time first-run tip. */
export default function HelpButton() {
  const [open, setOpen] = useState(false);
  const popoverId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const toolKind = useShipBuilderStore((s) => s.tool.kind);
  const isCoachVisible = useSyncExternalStore(
    coachSetting.subscribe,
    () => !coachSetting.get() && !isWebDriven(),
    () => false
  );

  // Picking a part means the tip has done its job.
  useEffect(() => {
    if (isCoachVisible && toolKind !== "none") dismissCoach();
  }, [isCoachVisible, toolKind]);

  // The cheat sheet supersedes the first-run tip, which would cover it.
  useEffect(() => {
    if (open) dismissCoach();
  }, [open]);

  // Tapping the ship or anywhere else closes the cheat sheet; so does Escape,
  // wherever focus is.
  useEffect(() => {
    if (!open) return;
    function handleDocumentKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleDocumentKeyDown);
    function handlePointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleDocumentKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
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
          aria-controls={open ? popoverId : undefined}
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
