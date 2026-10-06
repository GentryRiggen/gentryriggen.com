"use client";

import { Footprints } from "lucide-react";
import { useMemo } from "react";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { spawnOf } from "@/lib/ship-builder/walk";

/** Id used to hand focus back here when walking ends. */
export const WALK_BUTTON_ID = "walk-button";

/** Puts focus back on the Walk button once it has re-rendered. */
export function focusWalkButton() {
  requestAnimationFrame(() => document.getElementById(WALK_BUTTON_ID)?.focus());
}

const HINT_ID = "walk-button-hint";

/**
 * Starts walking the decks. It sits beside the Sea trial button (which hands
 * it to `SeaTrialButton` as `beside`, so it shows and hides with it). A ship
 * with nowhere to stand cannot be walked, so the button is disabled and says
 * why.
 */
export default function WalkButton() {
  const ship = useShipBuilderStore((s) => s.ship);
  const startWalk = useShipBuilderStore((s) => s.startWalk);
  const canWalk = useMemo(() => spawnOf(ship) !== null, [ship]);

  return (
    <div className="relative">
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
        onClick={startWalk}
        className="pointer-events-auto inline-flex min-h-11 touch-manipulation items-center justify-center gap-2 rounded-full bg-amber-600 px-5 text-sm font-semibold text-white shadow-lg hover:bg-amber-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-amber-500 dark:text-slate-900 dark:hover:bg-amber-400 dark:focus-visible:outline-amber-300"
      >
        <Footprints aria-hidden="true" className="h-5 w-5 shrink-0" />
        Walk
      </button>
    </div>
  );
}
