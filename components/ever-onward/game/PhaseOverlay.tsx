"use client";

import type { PhaseDef } from "@/lib/ever-onward/engine/types";
import LanternPicker from "./LanternPicker";
import PhaseBriefing from "./PhaseBriefing";
import CrtOverlay from "./retro/CrtOverlay";
import RetroHeading from "./retro/RetroHeading";
import {
  pixelClass,
  retroLabelClass,
  retroPanelClass,
  retroPrimaryButtonClass,
} from "./retro/retroStyles";

interface PhaseOverlayProps {
  phase: PhaseDef;
  /** Narration clip for the intro, if one is recorded. */
  clipId?: string;
  /** 1-based number of the phase and how many there are. */
  number: number;
  total: number;
  onContinue: () => void;
  /** The opening of a new run asks which lantern the last ship will carry. */
  lantern?: { value: number; onChange: (lantern: number) => void };
}

/** The intro card shown when a run starts and whenever a new part begins. */
export default function PhaseOverlay({
  phase,
  clipId,
  number,
  total,
  onContinue,
  lantern,
}: PhaseOverlayProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lm-phase-title"
      data-testid="lm-phase-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#02030a]/95 p-4 text-amber-50 sm:p-6"
    >
      <div className="pointer-events-none fixed inset-0">
        <CrtOverlay />
      </div>
      <div
        className={`${retroPanelClass} lm-fade-up relative my-auto w-full max-w-md space-y-5 p-5 sm:max-w-lg sm:p-8`}
      >
        <div className="space-y-3 text-center">
          <p className={`${retroLabelClass} leading-normal`}>
            Part {number} of {total}
          </p>
          <RetroHeading
            as="h2"
            id="lm-phase-title"
            className="text-xl leading-normal break-words sm:text-2xl"
          >
            {phase.title}
          </RetroHeading>
        </div>
        <PhaseBriefing phase={phase} clipId={clipId} isStaggered />
        {lantern && (
          <LanternPicker value={lantern.value} onChange={lantern.onChange} />
        )}
        <div className="text-center">
          <button
            type="button"
            autoFocus
            onClick={onContinue}
            className={`${retroPrimaryButtonClass} min-w-40 !ring-offset-slate-950`}
          >
            <span aria-hidden="true" className="motion-safe:animate-pulse">
              ▶
            </span>
            <span className={pixelClass}>Continue</span>
          </button>
        </div>
      </div>
    </div>
  );
}
