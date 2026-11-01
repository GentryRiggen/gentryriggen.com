import type { PhaseDef } from "@/lib/ever-onward/engine/types";
import { primaryButtonClass } from "../styles";

interface PhaseOverlayProps {
  phase: PhaseDef;
  /** 1-based number of the phase and how many there are. */
  number: number;
  total: number;
  onContinue: () => void;
}

export default function PhaseOverlay({
  phase,
  number,
  total,
  onContinue,
}: PhaseOverlayProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lm-phase-title"
      data-testid="lm-phase-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 p-6 text-slate-50"
    >
      <div className="lm-fade-up max-w-md space-y-4 text-center">
        <p className="text-sm uppercase tracking-widest text-amber-300">
          Part {number} of {total}
        </p>
        <h2 id="lm-phase-title" className="text-4xl font-bold">
          {phase.title}
        </h2>
        {phase.intro && <p className="text-lg text-slate-300">{phase.intro}</p>}
        <button
          type="button"
          autoFocus
          onClick={onContinue}
          className={`${primaryButtonClass} min-w-40 !ring-offset-slate-950`}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
