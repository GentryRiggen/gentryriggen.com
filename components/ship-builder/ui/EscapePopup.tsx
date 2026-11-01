"use client";

import { useEffect, useRef, useState } from "react";
import {
  ESCAPE_POPUPS,
  type EscapeMoment,
} from "@/lib/ship-builder/escapeCopy";
import { useEscape } from "@/lib/ship-builder/state/escapeLive";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { escapePopupFor } from "@/lib/ship-builder/walk/escapePopup";
import { activeEvacuation } from "../scene/trialTimeline";
import { trialPlayback } from "../scene/trialPlayback";
import { buttonClass, panelClass, primaryButtonClass } from "./styles";

/** How often the trial clock is read while waiting for the boat to get out. */
const CLOCK_POLL_MS = 150;
/** The splash card closes itself after this long. */
export const SPLASH_SHOWN_MS = 4000;

interface EscapePopupProps {
  /**
   * Fires once each time a card appears: the one place a moment starts
   * (voice hooks in here).
   */
  onShow?: (moment: EscapeMoment) => void;
}

/**
 * The escape's cards: saved, splash and frozen, one at a time, once each.
 * WalkHud places it up top so the joystick and buttons below stay usable.
 */
export default function EscapePopup({ onShow }: EscapePopupProps) {
  const { phase } = useEscape();
  const stopWalk = useShipBuilderStore((s) => s.stopWalk);
  const [t, setT] = useState(() => trialPlayback.time);
  const [closedKey, setClosedKey] = useState<string | null>(null);
  const card = useRef<HTMLDivElement>(null);

  const waitsForBoat = phase.kind === "in-boat" && !phase.fromWater;
  const launch =
    phase.kind === "in-boat"
      ? (activeEvacuation()?.launches.find((l) => l.boatId === phase.boatId) ??
        null)
      : null;
  const moment = escapePopupFor(phase, launch, t);
  const key =
    phase.kind === "aboard" || phase.kind === "jumping"
      ? null
      : `${phase.kind}:${phase.since}`;

  // The trial clock is not reactive: poll it until the boat is out.
  useEffect(() => {
    if (!waitsForBoat || moment) return;
    const read = () => setT(trialPlayback.time);
    read();
    const timer = setInterval(read, CLOCK_POLL_MS);
    return () => clearInterval(timer);
  }, [waitsForBoat, moment]);

  const isOpen = moment !== null && key !== closedKey;

  useEffect(() => {
    if (!isOpen || !moment) return;
    onShow?.(moment);
    card.current?.focus();
    // Once per card: the moment and phase key decide, not the callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, moment, key]);

  useEffect(() => {
    if (!isOpen || moment !== "splash") return;
    const timer = setTimeout(() => setClosedKey(key), SPLASH_SHOWN_MS);
    return () => clearTimeout(timer);
  }, [isOpen, moment, key]);

  if (!isOpen || !moment) return null;
  const { title, body } = ESCAPE_POPUPS[moment];
  const close = () => setClosedKey(key);

  return (
    <div
      ref={card}
      role="dialog"
      aria-live="polite"
      aria-label={title}
      data-testid="escape-popup"
      tabIndex={-1}
      className={`pointer-events-auto flex w-full max-w-sm flex-col gap-2 rounded-2xl border p-3 shadow-xl outline-none ${panelClass}`}
    >
      <p className="text-base font-bold">{title}</p>
      <p className="text-sm text-slate-700 dark:text-slate-300">{body}</p>
      <div className="flex flex-wrap justify-end gap-2">
        {moment === "splash" ? (
          <button
            type="button"
            onClick={close}
            className={`${primaryButtonClass} min-h-11`}
          >
            Swim!
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={close}
              className={`${buttonClass} min-h-11`}
            >
              Keep watching
            </button>
            <button
              type="button"
              onClick={stopWalk}
              className={`${primaryButtonClass} min-h-11`}
            >
              See how she did
            </button>
          </>
        )}
      </div>
    </div>
  );
}
