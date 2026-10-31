"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import BreakModeSwitch from "./BreakModeSwitch";
import LifeboatSwitch from "./LifeboatSwitch";
import { focusSeaTrialButton } from "./SeaTrialButton";
import { panelClass } from "./styles";
import {
  CARD_CANCEL_CLASS,
  CARD_PLACE_CLASS,
  CARD_SLOT_CLASS,
} from "./TrialSetupCard";
import TrialTimeRow from "./TrialTimeRow";

/**
 * The iceberg's setup card, shown while the player aims: the time of day,
 * the lifeboats, how she may break, where to tap, and a way out. Tapping the
 * hull starts the trial. It takes the bottom-centre slot the Sea trial button
 * leaves free while aiming.
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
    <div className={CARD_SLOT_CLASS}>
      <div data-trial-setup-card className={`${CARD_PLACE_CLASS} sm:max-w-3xl`}>
        {/* Kept low so the hull stays free to tap: no title (the pill says
          what to do), and the rows sit side by side from sm up. */}
        <section
          aria-label="Iceberg"
          className={`pointer-events-auto grid max-h-[calc(100cqh-10rem)] w-full min-w-0 gap-3 overflow-y-auto rounded-2xl border p-3 shadow-lg sm:grid-cols-3 ${panelClass}`}
        >
          <TrialTimeRow />
          <LifeboatSwitch />
          <BreakModeSwitch />
        </section>
        <div
          role="status"
          className={`pointer-events-auto flex items-center gap-2 rounded-full border py-1 pl-4 pr-1 text-sm font-medium shadow-lg ${panelClass}`}
        >
          <span>Tap where the iceberg hits</span>
          <button
            ref={cancelButton}
            type="button"
            onClick={handleCancel}
            className={CARD_CANCEL_CLASS}
          >
            <X aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
