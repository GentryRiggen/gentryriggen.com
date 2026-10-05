"use client";

import { Compass } from "lucide-react";
import { useMemo } from "react";
import { analyzeShip } from "@/lib/ship-builder/model/analysis";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";

/** Id the picker uses to hand focus back here. */
export const DRIVE_BUTTON_ID = "drive-button";

/** Puts focus back on the Drive button once it has re-rendered. */
export function focusDriveButton() {
  requestAnimationFrame(() =>
    document.getElementById(DRIVE_BUTTON_ID)?.focus()
  );
}

const HINT_ID = "drive-button-hint";

/**
 * Opens the drive picker. It sits beside the Sea trial button (which hands it
 * to `SeaTrialButton` as `beside`, so it shows and hides with it). A ship with
 * no engine cannot sail, so the button is disabled and says why.
 */
export default function DriveButton() {
  const ship = useShipBuilderStore((s) => s.ship);
  const openDrive = useShipBuilderStore((s) => s.openDrive);
  const canDrive = useMemo(
    () => analyzeShip(ship).stats.topSpeedKnots > 0,
    [ship]
  );

  return (
    <div className="relative">
      {!canDrive && (
        <p
          id={HINT_ID}
          className="pointer-events-none absolute bottom-full right-0 mb-2 whitespace-nowrap rounded-full bg-slate-900/80 px-3 py-1 text-xs font-medium text-white dark:bg-slate-100/90 dark:text-slate-900"
        >
          Add an engine to drive
        </p>
      )}
      <button
        id={DRIVE_BUTTON_ID}
        type="button"
        disabled={!canDrive}
        aria-describedby={canDrive ? undefined : HINT_ID}
        onClick={openDrive}
        className="pointer-events-auto inline-flex min-h-11 touch-manipulation items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white shadow-lg hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:focus-visible:outline-emerald-300"
      >
        <Compass aria-hidden="true" className="h-5 w-5 shrink-0" />
        Drive
      </button>
    </div>
  );
}
