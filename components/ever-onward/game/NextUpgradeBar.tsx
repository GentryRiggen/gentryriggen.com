"use client";

import type { NextUpgrade } from "@/lib/ever-onward/engine/pull";
import { focusRingClass } from "../styles";
import { useAnimatedNumber } from "./useAnimatedNumber";

interface NextUpgradeBarProps {
  next: NextUpgrade;
  /** Scrolls the player to the upgrade's card. */
  onSelect: () => void;
  testId: string;
}

/** A thin bar filling toward the next upgrade; glows once it can be bought. */
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
      className={`block w-full touch-manipulation rounded-lg px-1 py-1 text-left ${focusRingClass}`}
    >
      <span className="flex items-baseline justify-between gap-3 text-xs font-semibold text-slate-700 dark:text-slate-300">
        <span className="truncate">{next.upgrade.name}</span>
        <span
          className={`shrink-0 tabular-nums ${
            next.isReady ? "text-amber-700 dark:text-amber-300" : ""
          }`}
        >
          {label}
        </span>
      </span>
      <progress
        aria-hidden="true"
        value={filled}
        max={100}
        className={`mt-1 block h-1.5 w-full appearance-none overflow-hidden rounded-full [&::-moz-progress-bar]:rounded-full [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-slate-200 dark:[&::-webkit-progress-bar]:bg-slate-700 ${
          next.isReady
            ? "lm-glow [&::-moz-progress-bar]:bg-amber-500 [&::-webkit-progress-value]:bg-amber-500"
            : "[&::-moz-progress-bar]:bg-amber-400 [&::-webkit-progress-value]:bg-amber-400"
        } [&::-webkit-progress-value]:rounded-full`}
      />
    </button>
  );
}
