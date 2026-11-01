import { prestigeLabel } from "@/lib/ever-onward/engine/prestige";
import type { UniverseDef } from "@/lib/ever-onward/engine/types";
import { uiFor } from "../universes";
import {
  bodyClass,
  pixelClass,
  retroFocusClass,
  retroPanelClass,
  retroPrimaryButtonClass,
} from "./retro/retroStyles";

interface EmberTipProps {
  def: UniverseDef;
  onShow: () => void;
  onDismiss: () => void;
}

/** A one-time, friendly note the first time a run can be restarted. */
export default function EmberTip({ def, onShow, onDismiss }: EmberTipProps) {
  const { PrestigeIcon } = uiFor(def.id);
  const label = prestigeLabel(def);
  const plural = label.toLowerCase();
  return (
    <section
      aria-label={`New: ${plural}`}
      data-testid="lm-ember-tip"
      className={`${retroPanelClass} lm-fade-up space-y-3 p-4`}
    >
      <p
        className={`${pixelClass} flex items-center gap-2 text-[10px] text-orange-200`}
      >
        <span
          className={`${pixelClass} border-2 border-amber-300 bg-amber-500 px-1.5 py-1 text-[8px] leading-none text-slate-950`}
        >
          NEW
        </span>
        <PrestigeIcon className="h-4" />
        {label}
      </p>
      <p className={bodyClass}>
        You can start this world over any time and keep {plural}. {label} buy
        permanent upgrades, so every new run goes faster.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onShow}
          className={retroPrimaryButtonClass}
        >
          Show me
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className={`${pixelClass} inline-flex min-h-11 touch-manipulation items-center px-3 text-[10px] text-slate-300 underline decoration-slate-600 underline-offset-4 hover:text-amber-200 ${retroFocusClass}`}
        >
          Got it
        </button>
      </div>
    </section>
  );
}
