"use client";

import { Bomb, Settings, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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

const GEAR_CLASS =
  "inline-flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-full bg-slate-100 text-slate-800 hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 dark:focus-visible:outline-sky-400";

/**
 * Boom!'s aim pill: no questions first, just "tap the ship". The time of day,
 * lifeboats and how she breaks wait behind the gear for anyone who wants
 * them. The first tap on the ship drops the first bomb and starts it.
 */
export default function BombAimHint() {
  const isAiming = useShipBuilderStore(
    (s) => s.trial.status === "aiming" && s.trial.kind === "boom"
  );
  const cancelAim = useShipBuilderStore((s) => s.cancelAim);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // The menu item that began aiming is gone: hand focus to Cancel.
  useEffect(() => {
    if (isAiming) cancelButton.current?.focus();
  }, [isAiming]);

  if (!isAiming) {
    if (isSettingsOpen) setIsSettingsOpen(false);
    return null;
  }

  function handleCancel() {
    cancelAim();
    focusSeaTrialButton();
  }

  return (
    <div className={CARD_SLOT_CLASS}>
      <div data-trial-setup-card className={`${CARD_PLACE_CLASS} sm:max-w-3xl`}>
        {isSettingsOpen && (
          <section
            id="boom-settings"
            aria-label="Boom! settings"
            className={`pointer-events-auto grid max-h-[calc(100cqh-10rem)] w-full min-w-0 gap-3 overflow-y-auto rounded-2xl border p-3 shadow-lg sm:grid-cols-3 ${panelClass}`}
          >
            <TrialTimeRow />
            <LifeboatSwitch />
            <BreakModeSwitch />
          </section>
        )}
        <div
          role="status"
          className={`pointer-events-auto flex items-center gap-2 rounded-full border py-1 pl-4 pr-1 text-sm font-medium shadow-lg ${panelClass}`}
        >
          <Bomb
            aria-hidden="true"
            className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400"
          />
          <span>Tap the ship to drop a bomb</span>
          <button
            type="button"
            aria-label="Settings"
            title="Settings"
            aria-expanded={isSettingsOpen}
            aria-controls="boom-settings"
            onClick={() => setIsSettingsOpen((open) => !open)}
            className={GEAR_CLASS}
          >
            <Settings aria-hidden="true" className="h-4 w-4" />
          </button>
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
