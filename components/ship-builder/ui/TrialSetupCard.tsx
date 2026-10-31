"use client";

import { Play, Tornado, Waves, X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import useTrialChoices from "../hooks/useTrialChoices";
import { isSeaState } from "../scene/seaState";
import BreakModeSwitch from "./BreakModeSwitch";
import ChoiceRow from "./ChoiceRow";
import LifeboatSwitch from "./LifeboatSwitch";
import { focusSeaTrialButton } from "./SeaTrialButton";
import { SEA_CHOICES } from "./seaTrialText";
import { panelClass } from "./styles";
import TrialTimeRow from "./TrialTimeRow";

/**
 * The bottom-centre slot the setup cards and the aim card share, sized to
 * the canvas (so a card's height can be capped by it). Below 700px of canvas
 * it sits a row up, clear of the Help and Undo buttons in the corners, like
 * the Sea trial button.
 */
export const CARD_SLOT_CLASS =
  "pointer-events-none absolute inset-0 z-10 [container-type:size]";
export const CARD_PLACE_CLASS =
  "absolute inset-x-3 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+3.5rem)] mx-auto flex max-w-sm flex-col items-center gap-2 @min-[700px]:bottom-[max(0.75rem,env(safe-area-inset-bottom))]";

/** Cancel, shared by the setup cards and the iceberg aim card. */
export const CARD_CANCEL_CLASS =
  "inline-flex min-h-11 shrink-0 touch-manipulation items-center justify-center gap-1.5 rounded-full bg-slate-100 px-4 text-sm font-medium text-slate-800 hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 dark:focus-visible:outline-sky-400";

/**
 * The Waves or Shipwreck storm card: the trial's choices as big icon-and-word
 * rows, a Cancel and a big Go. It takes the bottom-centre slot the Sea trial
 * button leaves free. The scene previews the picks (the store's trial look);
 * Cancel and Esc go back to the main-screen look.
 */
export default function TrialSetupCard() {
  const kind = useShipBuilderStore((s) =>
    s.trial.status === "setup" ? s.trial.kind : null
  );
  if (kind === null) return null;
  return <SetupCard key={kind} kind={kind} />;
}

interface SetupCardProps {
  kind: "waves" | "storm";
}

function SetupCard({ kind }: SetupCardProps) {
  const sea = useShipBuilderStore((s) =>
    s.trial.status === "setup" ? s.trial.look.sea : null
  );
  const setTrialLook = useShipBuilderStore((s) => s.setTrialLook);
  const cancelTrialSetup = useShipBuilderStore((s) => s.cancelTrialSetup);
  const startSetupTrial = useShipBuilderStore((s) => s.startSetupTrial);
  const { setWaveSea } = useTrialChoices();
  const titleId = useId();
  const goButton = useRef<HTMLButtonElement>(null);
  const isStorm = kind === "storm";
  const Icon = isStorm ? Tornado : Waves;

  // The menu item that opened the card is gone: hand focus to Go, so Enter
  // starts the trial. Esc is handled by useKeyboardShortcuts.
  useEffect(() => {
    goButton.current?.focus();
  }, []);

  function handleCancel() {
    cancelTrialSetup();
    focusSeaTrialButton();
  }

  return (
    <div className={CARD_SLOT_CLASS}>
      <div className={CARD_PLACE_CLASS}>
        <section
          aria-labelledby={titleId}
          data-trial-setup-card
          className={`pointer-events-auto flex max-h-[calc(100cqh-6rem)] w-full min-w-0 flex-col gap-3 overflow-y-auto rounded-2xl border p-3 shadow-lg ${panelClass}`}
        >
          <div className="flex items-center gap-2">
            <Icon
              aria-hidden="true"
              className="h-6 w-6 shrink-0 text-sky-600 dark:text-sky-400"
            />
            <h2 id={titleId} className="min-w-0 flex-1 text-base font-semibold">
              {isStorm ? "Shipwreck storm" : "Waves"}
            </h2>
            <button
              type="button"
              onClick={handleCancel}
              className={CARD_CANCEL_CLASS}
            >
              <X aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              Cancel
            </button>
          </div>
          {!isStorm && sea !== null && isSeaState(sea) && (
            <ChoiceRow
              label="Sea"
              options={SEA_CHOICES}
              value={sea}
              onChange={(next) => {
                setTrialLook({ sea: next });
                setWaveSea(next);
              }}
            />
          )}
          <TrialTimeRow />
          {isStorm && <LifeboatSwitch />}
          {isStorm && <BreakModeSwitch />}
          <button
            ref={goButton}
            type="button"
            onClick={startSetupTrial}
            className="inline-flex min-h-12 w-full touch-manipulation items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 text-lg font-bold text-white shadow hover:bg-sky-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:bg-sky-500 dark:hover:bg-sky-400 dark:focus-visible:outline-sky-300"
          >
            <Play aria-hidden="true" className="h-5 w-5 shrink-0" />
            Go!
          </button>
        </section>
      </div>
    </div>
  );
}
