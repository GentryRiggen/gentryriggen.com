"use client";

import { ChevronUp, Sailboat, Snowflake, Waves } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import useSeaState from "../hooks/useSeaState";

/** Id the result card uses to hand focus back here. */
export const SEA_TRIAL_BUTTON_ID = "sea-trial-button";

/** Puts focus back on the Sea trial button once it has re-rendered. */
export function focusSeaTrialButton() {
  requestAnimationFrame(() =>
    document.getElementById(SEA_TRIAL_BUTTON_ID)?.focus()
  );
}

const MENU_ID = "sea-trial-menu";

const ITEM_CLASS =
  "flex min-h-11 w-full touch-manipulation items-center gap-2 rounded-lg px-3 text-left text-sm font-medium text-slate-800 hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sky-600 dark:text-slate-100 dark:hover:bg-slate-800 dark:focus-visible:bg-slate-800 dark:focus-visible:outline-sky-400";

/**
 * Starts a sea trial: a menu button that offers Waves (the v2.5 trial) or
 * Iceberg (aim, then strike). It floats bottom-centre, the slot the placement
 * hint and the selection bar use while a tool or a part is active, so it only
 * shows when both are idle, and not while a drive or a walk is on.
 */
export default function SeaTrialButton({
  beside,
}: {
  /** Another button shown next to this one, only while this one shows. */
  beside?: ReactNode;
}) {
  const isShown = useShipBuilderStore(
    (s) =>
      s.trial.status === "idle" &&
      s.drive.status === "idle" &&
      s.walk.status === "idle" &&
      s.tool.kind === "none" &&
      s.selectedId === null &&
      s.pendingRemoval === null
  );
  const startTrial = useShipBuilderStore((s) => s.startTrial);
  const aimIceberg = useShipBuilderStore((s) => s.aimIceberg);
  const { seaState } = useSeaState();
  const [isOpen, setIsOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  // Hand focus to the first item on open; close on a press outside.
  useEffect(() => {
    if (!isOpen) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    function handlePointerDown(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  // Hidden (aiming, a trial, a tool or a selection): forget the open menu so
  // it doesn't pop back open when the button returns.
  if (!isShown && isOpen) setIsOpen(false);
  if (!isShown) return null;

  function closeAndFocusTrigger() {
    setIsOpen(false);
    trigger.current?.focus();
  }

  /** Closes the menu first so it is not left open behind the new mode. */
  function pick(action: () => void) {
    setIsOpen(false);
    action();
  }

  function handleTriggerKeyDown(event: ReactKeyboardEvent) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    setIsOpen(true);
  }

  function handleMenuKeyDown(event: ReactKeyboardEvent) {
    const items = Array.from(
      menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []
    );
    const index = items.indexOf(document.activeElement as HTMLElement);
    const last = items.length - 1;
    const moves: Record<string, number> = {
      ArrowDown: index >= last ? 0 : index + 1,
      ArrowUp: index <= 0 ? last : index - 1,
      Home: 0,
      End: last,
    };
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeAndFocusTrigger();
    } else if (event.key === "Tab") {
      setIsOpen(false);
    } else if (event.key in moves) {
      event.preventDefault();
      items[moves[event.key]]?.focus();
    }
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-10 @container">
      <div
        ref={root}
        className="absolute inset-x-3 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+3.5rem)] mx-auto flex w-fit items-center justify-center gap-2 @min-[700px]:bottom-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <div className="relative">
          {isOpen && (
            <div
              ref={menu}
              id={MENU_ID}
              role="menu"
              aria-label="Sea trial"
              onKeyDown={handleMenuKeyDown}
              className="pointer-events-auto absolute bottom-full left-1/2 mb-2 w-44 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => pick(() => startTrial(seaState))}
                className={ITEM_CLASS}
              >
                <Waves
                  aria-hidden="true"
                  className="h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400"
                />
                Waves
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => pick(aimIceberg)}
                className={ITEM_CLASS}
              >
                <Snowflake
                  aria-hidden="true"
                  className="h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400"
                />
                Iceberg
              </button>
            </div>
          )}
          <button
            ref={trigger}
            id={SEA_TRIAL_BUTTON_ID}
            type="button"
            aria-haspopup="menu"
            aria-expanded={isOpen}
            aria-controls={isOpen ? MENU_ID : undefined}
            onClick={() => setIsOpen((open) => !open)}
            onKeyDown={handleTriggerKeyDown}
            className="pointer-events-auto inline-flex min-h-11 touch-manipulation items-center justify-center gap-2 whitespace-nowrap rounded-full bg-sky-600 px-4 text-sm font-semibold text-white shadow-lg hover:bg-sky-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:bg-sky-500 dark:hover:bg-sky-400 dark:focus-visible:outline-sky-300"
          >
            <Sailboat aria-hidden="true" className="h-5 w-5 shrink-0" />
            Sea trial
            <ChevronUp
              aria-hidden="true"
              className={`h-4 w-4 shrink-0 ${isOpen ? "rotate-180" : ""}`}
            />
          </button>
        </div>
        {beside}
      </div>
    </div>
  );
}
