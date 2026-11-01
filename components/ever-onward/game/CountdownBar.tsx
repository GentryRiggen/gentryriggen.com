import type { CountdownView } from "@/lib/ever-onward/engine/types";
import { formatNumber } from "@/lib/ever-onward/engine/format";
import { pixelClass, retroInsetClass } from "./retro/retroStyles";

const SEGMENTS = 20;

interface CountdownBarProps {
  view: CountdownView;
}

/** A bar that empties as something runs out, with ticks where things wake up. */
export default function CountdownBar({ view }: CountdownBarProps) {
  const share = Math.min(1, Math.max(0, view.value / view.max));
  return (
    <section
      aria-label={view.label}
      data-testid="lm-countdown"
      className={`${retroInsetClass} space-y-2 p-3`}
    >
      <p className="flex items-baseline justify-between gap-3">
        <span className={`${pixelClass} text-[8px] text-cyan-200`}>
          {view.label}
        </span>
        <span
          className={`${pixelClass} text-[10px] tabular-nums text-amber-100`}
        >
          {formatNumber(view.value)}
        </span>
      </p>
      <div
        role="progressbar"
        aria-label={view.label}
        aria-valuemin={0}
        aria-valuemax={view.max}
        aria-valuenow={Math.round(view.value)}
        className="flex h-4 gap-0.5 border-2 border-slate-600 bg-slate-950 p-0.5"
      >
        {Array.from({ length: SEGMENTS }, (_, i) => {
          const isFilled = i < Math.ceil(share * SEGMENTS);
          // A tick sits at the end of the segment a mark falls in.
          const hasMark = view.marks?.some(
            (mark) => Math.floor((mark / view.max) * SEGMENTS) === i
          );
          return (
            <span
              key={i}
              aria-hidden="true"
              className={`h-full flex-1 ${
                isFilled ? "bg-amber-300/80" : "bg-slate-800"
              } ${hasMark ? "border-l-2 border-cyan-300" : ""}`}
            />
          );
        })}
      </div>
      {view.detail && (
        <p className="font-mono text-xs text-slate-300">{view.detail}</p>
      )}
    </section>
  );
}
