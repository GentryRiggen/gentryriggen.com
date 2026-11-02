"use client";

import type { Ref } from "react";
import { formatNumber } from "@/lib/ever-onward/engine/format";
import type { NextUpgrade } from "@/lib/ever-onward/engine/pull";
import type { GoalView } from "@/lib/ever-onward/engine/types";
import type { RateTrend } from "@/lib/ever-onward/engine/rate";
import AnimatedValue from "./AnimatedValue";
import EffectFloater, { type Effect } from "./EffectFloater";
import RateReadout from "./RateReadout";
import GoalMeter from "./GoalMeter";
import NextUpgradeBar from "./NextUpgradeBar";
import {
  pixelClass,
  retroFocusClass,
  retroLabelClass,
} from "./retro/retroStyles";
import SpendFloater, { type Spend } from "./SpendFloater";

interface StickyHudProps {
  /** Lets the screen measure the bar so the layout can sit below it. */
  hudRef?: Ref<HTMLDivElement>;
  /** True while a full-screen moment covers the game. */
  isCovered: boolean;
  resourceId: string;
  resourceLabel: string;
  value: number;
  rate: number;
  trend: RateTrend;
  spend: Spend | null;
  effect: Effect | null;
  next: NextUpgrade | null;
  /** The part's goal, shown as the big top line, or null. */
  goal?: GoalView | null;
  /** A warning to keep in sight (e.g. out of oil), or null. */
  alert?: string | null;
  onSelectNext: () => void;
  /** Takes the player to the thing that fixes the warning. */
  onSelectAlert?: () => void;
}

const ICONS: Record<string, string> = {
  coins: "\u{1FA99}",
  power: "⚡",
  energy: "✨",
};

/** What the HUD shows for a resource's value. */
export const formatPrimary = (value: number): string =>
  formatNumber(Math.floor(value));

/**
 * The compact bar pinned to the top of the screen, always: the currency
 * counting up, its income and the progress toward the next upgrade.
 */
export default function StickyHud({
  hudRef,
  isCovered,
  resourceId,
  resourceLabel,
  value,
  rate,
  trend,
  spend,
  effect,
  next,
  goal = null,
  alert = null,
  onSelectNext,
  onSelectAlert,
}: StickyHudProps) {
  return (
    <div
      ref={hudRef}
      data-testid="lm-hud"
      role="region"
      aria-label="Status"
      aria-hidden={isCovered}
      inert={isCovered}
      className="fixed inset-x-0 top-0 z-30 border-b-4 border-amber-500/80 bg-slate-950 pt-[calc(env(safe-area-inset-top)+0.5rem)] shadow-[0_4px_0_#78350f] lg:left-[45%]"
    >
      <div className="relative mx-auto max-w-xl px-4 py-2">
        <div className="flex items-center justify-between gap-3">
          <p className="flex min-w-0 items-baseline gap-2">
            <span aria-hidden="true" className="text-base">
              {ICONS[resourceId] ?? ""}
            </span>
            <span className={`${retroLabelClass} truncate leading-none`}>
              {resourceLabel}
            </span>
            <AnimatedValue
              value={value}
              format={formatPrimary}
              testId="lm-hud-value"
              className={`${pixelClass} text-xl leading-none text-amber-100 [text-shadow:1px_1px_0_#78350f]`}
            />
            <RateReadout
              rate={rate}
              trend={trend}
              testId="lm-hud-rate"
              className="shrink-0 font-mono text-sm font-bold"
            />
          </p>
          {/* A small chip in the same row, so the bar never changes height
              when the warning comes and goes. The full text is in the page. */}
          {alert && (
            <button
              type="button"
              data-testid="lm-hud-alert"
              title={alert}
              aria-label={alert}
              onClick={onSelectAlert}
              className={`${pixelClass} -my-2.5 min-h-11 shrink-0 animate-pulse touch-manipulation border-2 border-red-500 bg-red-950 px-2 py-1 text-[10px] leading-none text-red-200 motion-reduce:animate-none ${retroFocusClass}`}
            >
              ⚠ {alert.split("!")[0]}!
            </button>
          )}
        </div>
        {goal && <GoalMeter goal={goal} />}
        {/* Reserves the bar's height when there is no next upgrade yet. */}
        <div className={goal ? "min-h-8" : "min-h-10"}>
          {next && (
            <NextUpgradeBar
              next={next}
              onSelect={onSelectNext}
              testId="lm-hud-next"
              isSmall={goal !== null}
            />
          )}
        </div>
        <SpendFloater spend={spend} />
        <EffectFloater
          effect={effect}
          testId="lm-hud-effect"
          isAnnounced={false}
        />
      </div>
    </div>
  );
}
