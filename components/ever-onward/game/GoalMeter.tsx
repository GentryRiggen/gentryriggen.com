import { formatNumber } from "@/lib/ever-onward/engine/format";
import type { GoalView } from "@/lib/ever-onward/engine/types";
import { pixelClass } from "./retro/retroStyles";

/** Full class names (Tailwind must see them): the next segment, filled in tenths. */
const FILL = [
  "w-0",
  "w-[10%]",
  "w-[20%]",
  "w-[30%]",
  "w-[40%]",
  "w-[50%]",
  "w-[60%]",
  "w-[70%]",
  "w-[80%]",
  "w-[90%]",
  "w-full",
] as const;

interface GoalMeterProps {
  goal: GoalView;
}

/**
 * The part's goal as the big line at the top of the screen: what to do
 * ("LIGHT THE COAST"), how far along ("3 / 8 lighthouses") and a segmented bar
 * with the next segment filling as the next step is saved up for.
 */
export default function GoalMeter({ goal }: GoalMeterProps) {
  const { label, current, target, unit, next, progress = 0 } = goal;
  const safeTarget = Number.isFinite(target) && target > 0 ? target : 1;
  const safeCurrent = Math.min(
    safeTarget,
    Math.max(0, Number.isFinite(current) ? current : 0)
  );
  const partial = Number.isFinite(progress)
    ? Math.min(1, Math.max(0, progress))
    : 0;
  const value = Math.min(safeTarget, safeCurrent + partial);
  const segments = Math.max(1, Math.min(Math.ceil(safeTarget), 16));
  const filledSegments = (value / safeTarget) * segments;
  return (
    <div
      data-testid="lm-goal"
      role="group"
      aria-label={`Goal: ${label}, ${current} of ${target}${unit ? ` ${unit}` : ""}`}
      className="mt-1"
    >
      <p className="flex items-baseline justify-between gap-3">
        <span
          className={`${pixelClass} truncate text-xs leading-none text-amber-300 [text-shadow:1px_1px_0_#78350f]`}
        >
          {label}
        </span>
        <span
          data-testid="lm-goal-count"
          className={`${pixelClass} shrink-0 text-xs leading-none tabular-nums text-amber-100`}
        >
          {formatNumber(safeCurrent)} / {formatNumber(safeTarget)}
          {unit && (
            <span className="ml-1 hidden text-[10px] text-cyan-200 min-[430px]:inline">
              {unit}
            </span>
          )}
        </span>
      </p>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={safeTarget}
        aria-valuenow={value}
        className="mt-1.5 flex gap-1"
      >
        {Array.from({ length: segments }, (_, i) => {
          const fill = Math.min(1, Math.max(0, filledSegments - i));
          const isDone = fill >= 1;
          return (
            <span
              key={i}
              data-testid={isDone ? "lm-goal-lit" : undefined}
              className={`relative h-3 flex-1 overflow-hidden border-2 ${
                isDone
                  ? "border-amber-200 bg-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.7)]"
                  : "border-slate-600 bg-slate-900"
              }`}
            >
              {!isDone && fill > 0 && (
                <span
                  className={`absolute inset-y-0 left-0 bg-amber-500/70 ${FILL[Math.round(fill * 10)]}`}
                />
              )}
            </span>
          );
        })}
      </div>
      {next && (
        <p className="mt-1 truncate font-mono text-xs font-bold text-cyan-100">
          {next}
        </p>
      )}
    </div>
  );
}
