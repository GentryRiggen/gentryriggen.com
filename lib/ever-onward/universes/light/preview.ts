import { cloneRun, projectDoneFlag } from "../../engine/engine";
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
  /** The word for a drop in the headline: "shorter" reads "40% shorter trip". */
  less?: string;
  /** Only the before-to-after line, no "×2" or "40% less" headline (a count). */
  isPlain?: boolean;
}

/** The run as it would be with one more level of `id`. */
function afterBuying(run: RunState, id: string): RunState {
  const after = cloneRun(run);
  after.owned[id] = (after.owned[id] ?? 0) + 1;
  syncDisplay(after);
  return after;
}

/** The run as it would be with project `id` done. */
function afterProject(run: RunState, id: string): RunState {
  const after = cloneRun(run);
  after.flags[projectDoneFlag(id)] = true;
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
    const lines = stats
      .flatMap((stat) => {
        const before = stat.read(run);
        const next = stat.read(after);
        const detail = previewLines(run, after, [stat]);
        if (!detail) return [];
        if (stat.isPlain) return [detail];
        if (before > 0 && next / before >= 1.1)
          return [
            `${times(next / before)} ${stat.label.toLowerCase()}\n${detail}`,
          ];
        if (before > next && next >= 0)
          return [
            `${short((1 - next / before) * 100)}% ${stat.less ?? "less"} ${stat.label.toLowerCase()}\n${detail}`,
          ];
        return [detail];
      })
      .join("\n");
    // Every line hidden: show them anyway ("Supply 0 MW → 0 MW"), so the card
    // still says what it touches and the engine can tell it changes nothing.
    if (lines) return lines;
    return previewLines(
      run,
      after,
      stats.map((stat) => ({ ...stat, isHiddenWhenSame: false }))
    ).replace(/ · /g, "\n");
  };
}

/** The same, for a project: each stat before and after it is done. */
export function projectPreviewOf(
  id: string,
  stats: readonly Stat[]
): (run: RunState) => string {
  return (run) => previewLines(run, afterProject(run, id), stats);
}

export function previewLines(
  run: RunState,
  after: RunState,
  stats: readonly Stat[]
): string {
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
}

/**
 * Builds an `effectPreview` that is one plain, felt line ("x2 ships", "+1
 * keeper (+12/s)"), read from the run before and after one more level of
 * `id`. Lines may break with a newline.
 */
export function plainOf(
  id: string,
  line: (before: RunState, after: RunState) => string
): (run: RunState) => string {
  return (run) => line(run, afterBuying(run, id));
}

/** "x2", "x1.6", "x2.5": a multiplier, no more digits than it needs. */
export const times = (n: number): string =>
  `\u00d7${Number(n.toFixed(n >= 10 ? 0 : 1))}`;
