"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { focusSeaTrialButton } from "./SeaTrialButton";
import { panelClass } from "./styles";

/**
 * Shows while the player aims the iceberg: where to tap, and a way out. It
 * takes the bottom-centre slot the Sea trial button leaves free while aiming.
 */
export default function IcebergAimHint() {
  const isAiming = useShipBuilderStore((s) => s.trial.status === "aiming");
  const cancelAim = useShipBuilderStore((s) => s.cancelAim);
  const cancelButton = useRef<HTMLButtonElement>(null);

  function handleCancel() {
    cancelAim();
    focusSeaTrialButton();
  }

  // The Iceberg menu item that began aiming is gone, so focus would drop to
  // the page: hand it to Cancel. Esc is handled by useKeyboardShortcuts.
  useEffect(() => {
    if (isAiming) cancelButton.current?.focus();
  }, [isAiming]);

  if (!isAiming) return null;
  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-10 mx-auto flex w-fit max-w-full justify-center">
      <div
        role="status"
        className={`pointer-events-auto flex items-center gap-2 rounded-full border py-1 pl-4 pr-1 text-sm font-medium shadow-lg ${panelClass}`}
      >
        <span>Tap where the iceberg hits</span>
        <button
          ref={cancelButton}
          type="button"
          onClick={handleCancel}
          className="inline-flex min-h-11 touch-manipulation items-center justify-center gap-1.5 rounded-full bg-slate-100 px-4 text-sm font-medium text-slate-800 hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 dark:focus-visible:outline-sky-400"
        >
          <X aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          Cancel
        </button>
      </div>
    </div>
  );
}
