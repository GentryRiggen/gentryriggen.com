"use client";

import {
  LABEL_SECONDS,
  MAX_LABELS,
  SPLASH_BELOW,
  deathLabelEls,
  deathLabels,
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

/** What each pooled node last showed, so unchanged frames write nothing. */
const paintedVersion: number[] = Array.from({ length: MAX_LABELS }, () => -1);
const paintedOpacity: number[] = Array.from({ length: MAX_LABELS }, () => -1);
const paintedX: number[] = Array.from({ length: MAX_LABELS }, () => NaN);
const paintedY: number[] = Array.from({ length: MAX_LABELS }, () => NaN);
const paintedScale: number[] = Array.from({ length: MAX_LABELS }, () => NaN);

/**
 * Paints one label at a screen position. Called from the frame loop: it only
 * touches the text, classes, opacity and transform when they changed.
 */
export function paintDeathLabel(
  el: HTMLElement,
  label: DeathLabel,
  x: number,
  y: number
): void {
  const slot = Math.max(0, deathLabels.indexOf(label));
  const tier = labelTier(label.people, label.startPopulation);
  if (paintedVersion[slot] !== label.version) {
    paintedVersion[slot] = label.version;
    el.textContent = deathLabelText(label.people);
    el.className = TIER_CLASS[tier];
  }
  const t = Math.min(1, label.age / LABEL_SECONDS);
  const rise = RISE_PX * (1 - (1 - t) * (1 - t));
  const pop = POP[tier] * Math.max(0, 1 - label.popAge / POP_SECONDS);
  const px = Math.round(x * 10) / 10;
  const py = Math.round((y - rise) * 10) / 10;
  const scale = Math.round((1 + pop) * 1000) / 1000;
  if (
    px !== paintedX[slot] ||
    py !== paintedY[slot] ||
    scale !== paintedScale[slot]
  ) {
    paintedX[slot] = px;
    paintedY[slot] = py;
    paintedScale[slot] = scale;
    el.style.transform = `translate3d(${px}px,${py}px,0) translate(-50%,-100%) scale(${scale})`;
  }
  const opacity = labelOpacity(label.age);
  if (Math.abs(opacity - paintedOpacity[slot]) > 0.01) {
    paintedOpacity[slot] = opacity;
    el.style.opacity = String(opacity);
  }
}

/** Hides a label node. */
export function hideDeathLabel(el: HTMLElement): void {
  el.style.opacity = "0";
  const slot = deathLabelEls.indexOf(el);
  if (slot >= 0) {
    paintedVersion[slot] = -1;
    paintedOpacity[slot] = -1;
  }
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
