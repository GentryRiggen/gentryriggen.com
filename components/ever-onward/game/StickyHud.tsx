"use client";

import { useEffect, useState, type Ref } from "react";
import { formatNumber } from "@/lib/ever-onward/engine/format";
import type { GaugeView, GoalView } from "@/lib/ever-onward/engine/types";
import type { RateTrend } from "@/lib/ever-onward/engine/rate";
import AnimatedValue from "./AnimatedValue";
import EffectFloater, { type Effect } from "./EffectFloater";
import RateReadout from "./RateReadout";
import { pixelClass, retroFocusClass } from "./retro/retroStyles";
import SpendFloater, { type Spend } from "./SpendFloater";

interface StickyHudProps {
  /** Lets the screen measure the bar so the layout can sit below it. */
  hudRef?: Ref<HTMLDivElement>;
  /** True while a full-screen moment covers the game. */
  isCovered: boolean;
  resourceId: string;
  resourceLabel: string;
  /** What the money is for, in a few words, shown when the money is tapped. */
  resourcePurpose?: string;
  value: number;
  rate: number;
  trend: RateTrend;
  spend: Spend | null;
  effect: Effect | null;
  /** The part's goal, a small icon and count, or null. */
  goal?: GoalView | null;
  /** A resource to keep in sight (the lamp oil), an icon and a bar, or null. */
  gauge?: GaugeView | null;
  /** A warning to keep in sight (e.g. out of oil), or null. */
  alert?: string | null;
  /** Takes the player to the thing that fixes the warning. */
  onSelectAlert?: () => void;
}

const ICONS: Record<string, string> = {
  coins: "\u{1FA99}",
  power: "⚡",
  energy: "✨",
};

/** Icons for the goal, by its unit; anything else gets a flag. */
const GOAL_ICONS: Record<string, string> = {
  lighthouses: "\u{1F5FC}",
  cities: "\u{1F3D9}\u{FE0F}",
  stars: "⭐",
  "% of the way": "⛵",
};

/** Icons for the watched gauge, by its label; anything else gets a dial. */
const GAUGE_ICONS: Record<string, string> = {
  OIL: "\u{1F6E2}\u{FE0F}",
  WATER: "\u{1F4A7}",
  LEAN: "⚖\u{FE0F}",
  WIND: "\u{1F4A8}",
  MOOD: "\u{1F642}",
  REAL: "\u{1F3A8}",
};

export const goalIcon = (goal: GoalView): string =>
  GOAL_ICONS[goal.unit ?? ""] ?? "\u{1F3C1}";
export const gaugeIcon = (gauge: GaugeView): string =>
  GAUGE_ICONS[gauge.label] ?? "\u{1F39A}\u{FE0F}";

type Tone = "ok" | "low" | "critical";

/** A tiny bar (share is 0 to 1). */
function MiniBar({ share, tone }: { share: number; tone: Tone }) {
  return (
    <progress
      aria-hidden="true"
      value={Math.min(1, Math.max(0, Number.isFinite(share) ? share : 0))}
      max={1}
      className={`block h-2.5 w-10 appearance-none overflow-hidden border-2 border-slate-600 sm:w-14 [&::-webkit-progress-bar]:bg-slate-900 ${
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

type Explained = "money" | "goal" | "gauge";

/** How long a tapped icon's explanation stays up. */
const EXPLAIN_MS = 4000;

const lower = (text: string): string =>
  text.charAt(0).toLowerCase() + text.slice(1);

const titleCase = (text: string): string =>
  text.charAt(0) + text.slice(1).toLowerCase();

/** One plain line saying what a tapped icon means. */
export function explain(
  which: Explained,
  props: Pick<
    StickyHudProps,
    "resourceLabel" | "resourcePurpose" | "goal" | "gauge"
  >
): string {
  const { resourceLabel, resourcePurpose, goal, gauge } = props;
  if (which === "goal" && goal) {
    const count = `${formatNumber(goal.current)} of ${formatNumber(goal.target)}${goal.unit ? ` ${goal.unit}` : ""}`;
    return `Goal: ${lower(titleCase(goal.label))}. ${count}.${goal.next ? ` ${goal.next}.` : ""}`;
  }
  if (which === "gauge" && gauge) {
    const amount =
      gauge.display ??
      `${formatNumber(Math.floor(gauge.current))} / ${formatNumber(Math.floor(gauge.max))}`;
    const state = gauge.isCritical
      ? " Nearly empty!"
      : gauge.isLow
        ? " Getting low."
        : "";
    return `${titleCase(gauge.label)}: ${amount}.${state}`;
  }
  return resourcePurpose
    ? `${resourceLabel}: ${lower(resourcePurpose)}`
    : resourceLabel;
}

/**
 * The bar pinned to the top of the screen: one row. The money (counting up,
 * with its income) is the big thing; the part's goal and the one gauge to
 * watch are small icons with a tiny bar. Tapping any of them says what it is.
 */
export default function StickyHud({
  hudRef,
  isCovered,
  resourceId,
  resourceLabel,
  resourcePurpose,
  value,
  rate,
  trend,
  spend,
  effect,
  goal = null,
  gauge = null,
  alert = null,
  onSelectAlert,
}: StickyHudProps) {
  const [explained, setExplained] = useState<Explained | null>(null);
  const toggle = (which: Explained) =>
    setExplained((current) => (current === which ? null : which));

  useEffect(() => {
    if (!explained) return;
    const timer = window.setTimeout(() => setExplained(null), EXPLAIN_MS);
    return () => window.clearTimeout(timer);
  }, [explained]);

  const gaugeTone: Tone = gauge?.isCritical
    ? "critical"
    : gauge?.isLow
      ? "low"
      : "ok";
  const goalShare = goal
    ? (goal.current + (goal.progress ?? 0)) /
      (goal.target > 0 ? goal.target : 1)
    : 0;
  const line =
    explained &&
    explain(explained, { resourceLabel, resourcePurpose, goal, gauge });
  const chip = `-my-1 flex min-h-11 shrink-0 touch-manipulation items-center gap-1.5 px-1.5 ${retroFocusClass}`;

  return (
    <div
      ref={hudRef}
      data-testid="lm-hud"
      role="region"
      aria-label="Status"
      aria-hidden={isCovered}
      inert={isCovered}
      className="fixed inset-x-0 top-0 z-30 border-b-4 border-amber-500/80 bg-slate-950 pt-[env(safe-area-inset-top)] shadow-[0_4px_0_#78350f] lg:left-[45%]"
    >
      <div className="relative mx-auto max-w-xl px-3 py-1.5">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            data-testid="lm-hud-money"
            aria-label={`${resourceLabel}: what is it for?`}
            onClick={() => toggle("money")}
            className={`${chip} min-w-0 -ml-1.5`}
          >
            <span aria-hidden="true" className="text-lg">
              {ICONS[resourceId] ?? ""}
            </span>
            <AnimatedValue
              value={value}
              format={formatPrimary}
              testId="lm-hud-value"
              className={`${pixelClass} shrink-0 text-xl leading-none text-amber-100 [text-shadow:1px_1px_0_#78350f]`}
            />
            <RateReadout
              rate={rate}
              trend={trend}
              testId="lm-hud-rate"
              className="min-w-0 truncate font-mono text-sm font-bold"
            />
          </button>
          <div className="flex shrink-0 items-center gap-1">
            {alert && (
              <button
                type="button"
                data-testid="lm-hud-alert"
                title={alert}
                aria-label={alert}
                onClick={onSelectAlert}
                className={`${chip} animate-pulse border-2 border-red-500 bg-red-950 text-base motion-reduce:animate-none`}
              >
                <span aria-hidden="true">⚠️</span>
              </button>
            )}
            {gauge && (
              <button
                type="button"
                data-testid="lm-hud-gauge"
                data-tone={gaugeTone}
                aria-label={explain("gauge", {
                  resourceLabel,
                  goal,
                  gauge,
                })}
                onClick={() => toggle("gauge")}
                className={chip}
              >
                <span aria-hidden="true" className="text-base">
                  {gaugeIcon(gauge)}
                </span>
                {gauge.hasBar === false ? (
                  <span
                    className={`${pixelClass} text-[10px] leading-none text-cyan-200`}
                  >
                    {formatNumber(Math.floor(gauge.current))}
                  </span>
                ) : (
                  <MiniBar
                    share={gauge.current / (gauge.max || 1)}
                    tone={gaugeTone}
                  />
                )}
              </button>
            )}
            {goal && (
              <button
                type="button"
                data-testid="lm-goal"
                aria-label={explain("goal", { resourceLabel, goal, gauge })}
                onClick={() => toggle("goal")}
                className={chip}
              >
                <span aria-hidden="true" className="text-base">
                  {goalIcon(goal)}
                </span>
                <span
                  data-testid="lm-goal-count"
                  className={`${pixelClass} text-[10px] leading-none tabular-nums text-amber-100`}
                >
                  {formatNumber(goal.current)}/{formatNumber(goal.target)}
                </span>
                <MiniBar share={goalShare} tone="ok" />
              </button>
            )}
          </div>
        </div>
        {line && (
          <p
            data-testid="lm-hud-explain"
            role="status"
            className="absolute inset-x-3 top-full mt-1 border-2 border-amber-500/80 bg-slate-950 px-2 py-1.5 font-mono text-xs leading-snug text-slate-100 shadow-[0_4px_0_#78350f]"
          >
            {line}
          </p>
        )}
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

/** One easing for the scene's fold on phones. */
export const FOLD_EASE =
  "duration-300 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none";

/** What the HUD shows for a resource's value. */
export const formatPrimary = (value: number): string =>
  formatNumber(Math.floor(value));
