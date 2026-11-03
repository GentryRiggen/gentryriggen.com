"use client";

import type { Ref } from "react";
import { formatNumber } from "@/lib/ever-onward/engine/format";
import type { NextUpgrade } from "@/lib/ever-onward/engine/pull";
import type { GaugeView, GoalView } from "@/lib/ever-onward/engine/types";
import type { RateTrend } from "@/lib/ever-onward/engine/rate";
import AnimatedValue from "./AnimatedValue";
import EffectFloater, { type Effect } from "./EffectFloater";
import RateReadout from "./RateReadout";
import GaugeMeter from "./GaugeMeter";
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
  /** A resource to keep in sight (the lamp oil), or null. */
  gauge?: GaugeView | null;
  /** A warning to keep in sight (e.g. out of oil), or null. */
  alert?: string | null;
  onSelectNext: () => void;
  /** Takes the player to the thing that fixes the warning. */
  onSelectAlert?: () => void;
  /** Folded to one slim row (phones, scrolled down). */
  isCompact?: boolean;
  /** Scrolled down: the row offers to open or fold the bar. */
  isFolded?: boolean;
  onToggleCompact?: () => void;
}

const ICONS: Record<string, string> = {
  coins: "\u{1FA99}",
  power: "⚡",
  energy: "✨",
};

type MiniTone = "ok" | "low" | "critical";

/** A tiny bar for the slim row (share is 0 to 1). */
function MiniBar({ share, tone }: { share: number; tone: MiniTone }) {
  return (
    <progress
      aria-hidden="true"
      value={Math.min(1, Math.max(0, Number.isFinite(share) ? share : 0))}
      max={1}
      className={`block h-2.5 w-10 appearance-none overflow-hidden border-2 border-slate-600 [&::-webkit-progress-bar]:bg-slate-900 ${
        {
          ok: "[&::-webkit-progress-value]:bg-amber-400 [&::-moz-progress-bar]:bg-amber-400",
          low: "border-orange-400 [&::-webkit-progress-value]:bg-orange-500 [&::-moz-progress-bar]:bg-orange-500",
          critical:
            "animate-pulse border-red-400 [&::-webkit-progress-value]:bg-red-500 [&::-moz-progress-bar]:bg-red-500 motion-reduce:animate-none",
        }[tone]
      }`}
    />
  );
}

/** The goal in the slim row: "4/8" and a tiny bar. */
function MiniGoal({ goal }: { goal: GoalView }) {
  const target = goal.target > 0 ? goal.target : 1;
  const share = (goal.current + (goal.progress ?? 0)) / target;
  return (
    <span data-testid="lm-hud-mini-goal" className="flex items-center gap-1">
      <span
        className={`${pixelClass} text-[10px] leading-none tabular-nums text-amber-100`}
      >
        {formatNumber(goal.current)}/{formatNumber(goal.target)}
      </span>
      <MiniBar share={share} tone="ok" />
    </span>
  );
}

/** The watched gauge in the slim row: its name and a tiny coloured bar. */
function MiniGauge({ gauge }: { gauge: GaugeView }) {
  const tone = gauge.isCritical ? "critical" : gauge.isLow ? "low" : "ok";
  return (
    <span
      data-testid="lm-hud-mini-gauge"
      data-tone={tone}
      className="flex items-center gap-1"
    >
      <span
        className={`${pixelClass} text-[10px] leading-none ${
          tone === "critical"
            ? "text-red-300"
            : tone === "low"
              ? "text-orange-300"
              : "text-cyan-200"
        }`}
      >
        {gauge.label.split(" ")[0]}
      </span>
      {gauge.hasBar !== false && (
        <MiniBar share={gauge.current / (gauge.max || 1)} tone={tone} />
      )}
    </span>
  );
}

/** One easing for the whole fold, so the bar and the scene move together. */
export const FOLD_EASE =
  "duration-300 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none";

/** Slim-row bits ease in when the bar folds. */
const FADE_IN =
  "animate-[lmHudIn_300ms_cubic-bezier(0.2,0,0,1)_both] motion-reduce:animate-none";

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
  gauge = null,
  alert = null,
  onSelectNext,
  onSelectAlert,
  isCompact = false,
  isFolded = false,
  onToggleCompact,
}: StickyHudProps) {
  return (
    <div
      ref={hudRef}
      data-testid="lm-hud"
      data-compact={isCompact}
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
            <span
              className={`${retroLabelClass} truncate leading-none transition-[max-width,opacity,margin] ${FOLD_EASE} ${isCompact ? "-mr-2 max-w-0 opacity-0" : "max-w-48 opacity-100"}`}
            >
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
              className={`shrink-0 font-mono font-bold text-sm`}
            />
          </p>
          {isFolded && (
            <button
              type="button"
              data-testid="lm-hud-toggle"
              aria-expanded={!isCompact}
              aria-label={
                isCompact ? "Show the goal and details" : "Fold the bar"
              }
              onClick={onToggleCompact}
              className={`-my-2.5 flex min-h-11 shrink-0 touch-manipulation items-center gap-2 px-1 ${FADE_IN} ${retroFocusClass}`}
            >
              {isCompact && goal && (
                <span className={FADE_IN}>
                  <MiniGoal goal={goal} />
                </span>
              )}
              {isCompact && gauge && (
                <span className={FADE_IN}>
                  <MiniGauge gauge={gauge} />
                </span>
              )}
              <span
                aria-hidden="true"
                className={`${pixelClass} text-xs leading-none text-amber-300`}
              >
                {isCompact ? "▾" : "▴"}
              </span>
            </button>
          )}
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
        {/* The details slide shut rather than vanish. They stay in the page
            (hidden once shut), so their full height can still be measured. */}
        <div
          data-testid="lm-hud-details"
          data-hud-clip=""
          inert={isCompact}
          className={`grid transition-[grid-template-rows,opacity,visibility] ${FOLD_EASE} ${
            isCompact
              ? "invisible grid-rows-[0fr] opacity-0"
              : "visible grid-rows-[1fr] opacity-100"
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            <div data-hud-details="" className="flow-root">
              {goal && <GoalMeter goal={goal} />}
              {gauge && (
                <div className="mt-2">
                  <GaugeMeter gauge={gauge} testId="lm-hud-gauge" />
                </div>
              )}
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
            </div>
          </div>
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
