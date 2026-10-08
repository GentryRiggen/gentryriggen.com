"use client";

import { Footprints } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { FocusEvent, KeyboardEvent } from "react";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { spawnOf, type WalkStart } from "@/lib/ship-builder/walk";
import WalkStartPicker from "./WalkStartPicker";

/** Id used to hand focus back here when walking ends. */
export const WALK_BUTTON_ID = "walk-button";

/** Puts focus back on the Walk button once it has re-rendered. */
export function focusWalkButton() {
  requestAnimationFrame(() => document.getElementById(WALK_BUTTON_ID)?.focus());
}

const HINT_ID = "walk-button-hint";

interface WalkButtonProps {
  /** How the start card lines up over the button (centred in a trial). */
  align?: "end" | "center";
}

/**
 * Starts walking the decks: tapping it opens a card to pick where to start
 * (front, middle or back). It sits beside the Sea trial button (which hands
 * it to `SeaTrialButton` as `beside`, so it shows and hides with it), and
 * `TrialWalkButton` renders it on its own while a trial runs. A ship
 * with nowhere to stand cannot be walked, so the button is disabled and says
 * why.
 */
export default function WalkButton({ align = "end" }: WalkButtonProps) {
  const ship = useShipBuilderStore((s) => s.ship);
  const startWalk = useShipBuilderStore((s) => s.startWalk);
  const canWalk = useMemo(() => spawnOf(ship) !== null, [ship]);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const cardId = useId();
  // Adjusting state during render: a ship that can no longer be walked (an
  // undo removed the deck) closes the card for good, so a redo cannot pop it
  // back open.
  if (isOpen && !canWalk) setIsOpen(false);
  const isCardOpen = isOpen && canWalk;

  useEffect(() => {
    if (!isCardOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isCardOpen]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape" || !isCardOpen) return;
    // Only the card closes: the global Escape would also act on the builder.
    event.stopPropagation();
    setIsOpen(false);
    document.getElementById(WALK_BUTTON_ID)?.focus();
  }

  /** Tabbing out of the card (or the button) closes it. */
  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    const next = event.relatedTarget as Node | null;
    if (next && !event.currentTarget.contains(next)) setIsOpen(false);
  }

  function handlePick(start: WalkStart) {
    setIsOpen(false);
    startWalk(start);
  }

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
    >
      {!canWalk && (
        <p
          id={HINT_ID}
          className="pointer-events-none absolute bottom-full right-0 mb-2 whitespace-nowrap rounded-full bg-slate-900/80 px-3 py-1 text-xs font-medium text-white dark:bg-slate-100/90 dark:text-slate-900"
        >
          Add a deck to walk on
        </p>
      )}
      <button
        id={WALK_BUTTON_ID}
        type="button"
        disabled={!canWalk}
        aria-describedby={canWalk ? undefined : HINT_ID}
        aria-haspopup={canWalk ? "dialog" : undefined}
        aria-expanded={canWalk ? isCardOpen : undefined}
        aria-controls={isCardOpen ? cardId : undefined}
        onClick={() => setIsOpen((open) => !open)}
        className="pointer-events-auto inline-flex min-h-11 touch-manipulation items-center justify-center gap-2 whitespace-nowrap rounded-full bg-amber-600 px-4 text-sm font-semibold text-white shadow-lg hover:bg-amber-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-amber-500 dark:text-slate-900 dark:hover:bg-amber-400 dark:focus-visible:outline-amber-300"
      >
        <Footprints aria-hidden="true" className="h-5 w-5 shrink-0" />
        Walk
      </button>
      {isCardOpen && (
        <WalkStartPicker id={cardId} onPick={handlePick} align={align} />
      )}
    </div>
  );
}
