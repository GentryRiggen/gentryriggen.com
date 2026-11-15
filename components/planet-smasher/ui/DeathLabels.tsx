"use client";

import {
  LABEL_SECONDS,
  MAX_LABELS,
  SPLASH_BELOW,
  deathLabelEls,
  labelTier,
  type DeathLabel,
  type LabelTier,
} from "@/lib/planet-smasher/deathLabels";
import { formatPeople } from "./format";

const BASE =
  "pointer-events-none absolute left-0 top-0 whitespace-nowrap font-mono font-black opacity-0 will-change-transform drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)]";

const TIER_CLASS: Record<LabelTier, string> = {
  small: `${BASE} text-sm text-slate-200 sm:text-base`,
  medium: `${BASE} text-lg text-white sm:text-2xl`,
  big: `${BASE} text-2xl text-yellow-300 sm:text-4xl`,
  huge: `${BASE} text-4xl text-orange-500 sm:text-6xl`,
};

/** How far the label rises, in pixels. */
const RISE_PX = 40;
/** The extra scale of the pop at birth, by tier. */
const POP: Record<LabelTier, number> = {
  small: 0,
  medium: 0.1,
  big: 0.25,
  huge: 0.5,
};
const POP_SECONDS = 0.3;

/** The label text: a splash for a handful of people, else a skull and count. */
export function deathLabelText(people: number): string {
  return people < SPLASH_BELOW ? "💦" : `💀 ${formatPeople(people)}`;
}

/** Opacity over a label's life: full, then a fade over the last 40%. */
export function labelOpacity(age: number): number {
  const fadeFrom = LABEL_SECONDS * 0.6;
  if (age <= fadeFrom) return 1;
  return Math.max(0, 1 - (age - fadeFrom) / (LABEL_SECONDS - fadeFrom));
}

/**
 * Paints one label at a screen position. Called from the frame loop: it only
 * touches the text and classes when the label changed.
 */
export function paintDeathLabel(
  el: HTMLElement,
  label: DeathLabel,
  x: number,
  y: number
): void {
  const tier = labelTier(label.people, label.startPopulation);
  if (el.dataset.version !== String(label.version)) {
    el.dataset.version = String(label.version);
    el.textContent = deathLabelText(label.people);
    el.className = TIER_CLASS[tier];
  }
  const t = Math.min(1, label.age / LABEL_SECONDS);
  const rise = RISE_PX * (1 - (1 - t) * (1 - t));
  const pop = POP[tier] * Math.max(0, 1 - label.age / POP_SECONDS);
  el.style.transform = `translate3d(${x.toFixed(1)}px,${(y - rise).toFixed(1)}px,0) translate(-50%,-100%) scale(${(1 + pop).toFixed(3)})`;
  el.style.opacity = String(labelOpacity(label.age));
}

/** Hides a label node. */
export function hideDeathLabel(el: HTMLElement): void {
  el.style.opacity = "0";
  delete el.dataset.version;
}

/**
 * Pooled floating death counts. The nodes never mount or unmount; the
 * DeathLabelDriver (inside the canvas) moves them every frame.
 */
export default function DeathLabels() {
  return (
    <div
      data-testid="death-labels"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {Array.from({ length: MAX_LABELS }, (_, i) => (
        <span
          key={i}
          ref={(el) => {
            deathLabelEls[i] = el;
          }}
          className={TIER_CLASS.small}
        />
      ))}
    </div>
  );
}
