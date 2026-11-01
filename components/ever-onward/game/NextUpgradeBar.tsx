"use client";

import type { NextUpgrade } from "@/lib/ever-onward/engine/pull";
import { pixelClass, retroFocusClass } from "./retro/retroStyles";
import { useAnimatedNumber } from "./useAnimatedNumber";

interface NextUpgradeBarProps {
  next: NextUpgrade;
  /** Scrolls the player to the upgrade's card. */
  onSelect: () => void;
  testId: string;
}

/** A segmented bar filling toward the next upgrade; glows once it can be bought. */
export default function NextUpgradeBar({
  next,
  onSelect,
  testId,
}: NextUpgradeBarProps) {
  const filled = useAnimatedNumber(next.percent);
  const label = next.isReady ? "Ready" : `${next.percent}%`;
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onSelect}
      aria-label={`Next goal: ${next.upgrade.name}, ${label}. Go to upgrade`}
      className={`block w-full touch-manipulation px-1 py-1.5 text-left ${retroFocusClass}`}
    >
      <span className="flex items-baseline justify-between gap-3">
        <span className={`${pixelClass} truncate text-[8px] text-cyan-200`}>
          <span aria-hidden="true" className="mr-1.5 text-amber-300">
            ▶︎
          </span>
          {next.upgrade.name}
        </span>
        <span
          className={`${pixelClass} shrink-0 text-[8px] tabular-nums ${
            next.isReady ? "text-amber-300" : "text-slate-200"
          }`}
        >
          {label}
        </span>
      </span>
      <span className="relative mt-1.5 block">
        <progress
          aria-hidden="true"
          value={filled}
          max={100}
          className={`block h-3 w-full appearance-none overflow-hidden border-2 [&::-webkit-progress-bar]:bg-slate-900 [&::-moz-progress-bar]:bg-amber-400 [&::-webkit-progress-value]:bg-amber-400 ${
            next.isReady
              ? "border-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.6)]"
              : "border-slate-600"
          }`}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(to_right,transparent_0,transparent_6px,#020617_6px,#020617_8px)]"
        />
      </span>
    </button>
  );
}
