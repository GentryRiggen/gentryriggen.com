import { cloneRun } from "../../engine/engine";
import { formatNumber } from "../../engine/format";
import type { RunState } from "../../engine/types";
import { syncDisplay } from "./tick";

/** A short number for a before-to-after line: 0.45, 12.5, 130, 1.50K. */
export function short(value: number): string {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value) >= 1000) return formatNumber(value);
  if (Math.abs(value) >= 100) return String(Math.round(value));
  const digits = Math.abs(value) >= 10 ? 1 : 2;
  return String(Number(value.toFixed(digits)));
}

export interface Stat {
  label: string;
  read(run: RunState): number;
  format?(value: number): string;
  suffix?: string;
  /** Leave the line out while it would not change ("Coins/sec 0 → 0"). */
  isHiddenWhenSame?: boolean;
}

/** The run as it would be with one more level of `id`. */
function afterBuying(run: RunState, id: string): RunState {
  const after = cloneRun(run);
  after.owned[id] = (after.owned[id] ?? 0) + 1;
  syncDisplay(after);
  return after;
}

/**
 * Builds an `effectPreview` that reads each stat before and after buying one
 * more level of `id`: "Coins/sec 12 -> 17".
 */
export function previewOf(
  id: string,
  stats: readonly Stat[]
): (run: RunState) => string {
  return (run) => {
    const after = afterBuying(run, id);
    return stats
      .flatMap((stat) => {
        const format = stat.format ?? short;
        const suffix = stat.suffix ?? "";
        const before = format(stat.read(run));
        const next = format(stat.read(after));
        if (stat.isHiddenWhenSame && before === next) return [];
        return [`${stat.label} ${before}${suffix} → ${next}${suffix}`];
      })
      .join(" · ");
  };
}
