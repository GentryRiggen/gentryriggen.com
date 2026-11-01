import EmberIcon from "./EmberIcon";
import {
  bodyClass,
  pixelClass,
  retroFocusClass,
  retroPanelClass,
  retroPrimaryButtonClass,
} from "./retro/retroStyles";

interface EmberTipProps {
  onShow: () => void;
  onDismiss: () => void;
}

/** A one-time, friendly note the first time a run can be restarted. */
export default function EmberTip({ onShow, onDismiss }: EmberTipProps) {
  return (
    <section
      aria-label="New: embers"
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
        <EmberIcon className="h-4" />
        Embers
      </p>
      <p className={bodyClass}>
        You can start this world over any time and keep embers. Embers buy
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
