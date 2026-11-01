"use client";

import { useRef } from "react";
import { formatNumber } from "@/lib/ever-onward/engine/format";
import type { NextUpgrade } from "@/lib/ever-onward/engine/pull";
import { focusRingClass } from "../styles";
import AnimatedValue from "./AnimatedValue";
import NextUpgradeBar from "./NextUpgradeBar";
import SpendFloater, { type Spend } from "./SpendFloater";

interface StickyHudProps {
  isShown: boolean;
  /** True while a full-screen moment covers the game. */
  isCovered: boolean;
  resourceId: string;
  resourceLabel: string;
  value: number;
  rate: number;
  spend: Spend | null;
  next: NextUpgrade | null;
  tapLabel: string;
  onTap: () => void;
  onSelectNext: () => void;
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
 * A compact bar pinned to the top of the screen while the main readouts are
 * scrolled away: the currency counting up, its income, a mini tap button and
 * the progress toward the next upgrade.
 */
export default function StickyHud({
  isShown,
  isCovered,
  resourceId,
  resourceLabel,
  value,
  rate,
  spend,
  next,
  tapLabel,
  onTap,
  onSelectNext,
}: StickyHudProps) {
  const tapRef = useRef<HTMLButtonElement>(null);
  const isHidden = !isShown || isCovered;

  const handleTap = () => {
    onTap();
    const button = tapRef.current;
    if (!button) return;
    button.classList.remove("lm-press");
    void button.offsetWidth;
    button.classList.add("lm-press");
  };

  return (
    <div
      data-testid="lm-hud"
      aria-hidden={isHidden}
      inert={isHidden}
      className={`fixed inset-x-0 top-0 z-30 border-b border-slate-200 bg-white/95 pt-[env(safe-area-inset-top)] shadow-md backdrop-blur transition-transform duration-300 motion-reduce:transition-none lg:left-[55%] dark:border-slate-800 dark:bg-slate-900/95 ${
        isHidden ? "-translate-y-full" : "translate-y-0"
      }`}
    >
      <div className="relative mx-auto max-w-xl px-4 py-2">
        <div className="flex items-center justify-between gap-3">
          <p className="flex min-w-0 items-baseline gap-2">
            <span aria-hidden="true" className="text-xl">
              {ICONS[resourceId] ?? ""}
            </span>
            <span className="sr-only">{resourceLabel}</span>
            <AnimatedValue
              value={value}
              format={formatPrimary}
              testId="lm-hud-value"
              className="text-3xl font-bold leading-none text-slate-900 dark:text-slate-50"
            />
            <span
              data-testid="lm-hud-rate"
              className="shrink-0 text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400"
            >
              +{formatNumber(rate)}/s
            </span>
          </p>
          <button
            ref={tapRef}
            type="button"
            data-testid="lm-hud-tap"
            onClick={handleTap}
            className={`min-h-11 shrink-0 touch-manipulation select-none rounded-xl bg-amber-400 px-4 text-sm font-bold text-amber-950 active:brightness-95 dark:bg-amber-500 ${focusRingClass}`}
          >
            {tapLabel}
          </button>
        </div>
        {next && (
          <NextUpgradeBar
            next={next}
            onSelect={onSelectNext}
            testId="lm-hud-next"
          />
        )}
        <SpendFloater spend={spend} />
      </div>
    </div>
  );
}
