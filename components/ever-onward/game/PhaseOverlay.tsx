import type { PhaseDef } from "@/lib/ever-onward/engine/types";
import ListenButton from "../narration/ListenButton";
import { primaryButtonClass, secondaryButtonClass } from "../styles";

interface PhaseOverlayProps {
  phase: PhaseDef;
  /** Narration clip for the intro, if one is recorded. */
  clipId?: string;
  /** 1-based number of the phase and how many there are. */
  number: number;
  total: number;
  onContinue: () => void;
}

export default function PhaseOverlay({
  phase,
  clipId,
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
        {phase.intro && clipId && (
          <div>
            <ListenButton
              clipId={clipId}
              label="Listen"
              accessibleLabel="Listen to this introduction"
              className={`${secondaryButtonClass} gap-2 !border-slate-600 !bg-slate-900 !text-slate-100`}
            />
          </div>
        )}
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
