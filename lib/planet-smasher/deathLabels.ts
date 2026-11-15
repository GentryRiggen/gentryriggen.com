import { angularDistance, uvToDir, type Vec3 } from "./sphere";

/** At most this many labels float at once. */
export const MAX_LABELS = 6;
/** A hit this soon after, and this close to, a label adds to it. */
export const MERGE_SECONDS = 0.25;
export const MERGE_RADIANS = 0.15;
/** How long a label lives (effect time, so slow-motion slows it). */
export const LABEL_SECONDS = 1.2;
/** Under this many people the label is a splash, not a number. */
export const SPLASH_BELOW = 1000;

export type LabelTier = "small" | "medium" | "big" | "huge";

/** Size and colour tier by the share of the start population lost. */
export function labelTier(people: number, startPopulation: number): LabelTier {
  const share = startPopulation > 0 ? people / startPopulation : 0;
  if (share < 0.0005) return "small";
  if (share < 0.005) return "medium";
  if (share < 0.02) return "big";
  return "huge";
}

export interface DeathLabel {
  active: boolean;
  /** Unit direction of the hit on the planet. */
  dir: Vec3;
  people: number;
  startPopulation: number;
  /** Seconds since it appeared or last grew. */
  age: number;
  /** Bumps whenever the text or tier changes, so the DOM updates only then. */
  version: number;
}

function blank(): DeathLabel {
  return {
    active: false,
    dir: { x: 0, y: 0, z: 1 },
    people: 0,
    startPopulation: 1,
    age: 0,
    version: 0,
  };
}

/** The pool: fixed slots, reused, never reallocated. */
export const deathLabels: DeathLabel[] = Array.from(
  { length: MAX_LABELS },
  blank
);

/** Adds a hit's deaths, merging into a fresh nearby label when there is one. */
export function addDeathLabel(
  people: number,
  u: number,
  v: number,
  startPopulation: number
): void {
  if (!(people > 0)) return;
  const dir = uvToDir(u, v);
  for (const l of deathLabels) {
    if (
      l.active &&
      l.age <= MERGE_SECONDS &&
      angularDistance(l.dir, dir) <= MERGE_RADIANS
    ) {
      l.people += people;
      l.age = 0;
      l.version++;
      return;
    }
  }
  // A free slot, else replace the oldest label.
  let slot = deathLabels.find((l) => !l.active);
  if (!slot) {
    slot = deathLabels[0];
    for (const l of deathLabels) if (l.age > slot.age) slot = l;
  }
  slot.active = true;
  slot.dir = dir;
  slot.people = people;
  slot.startPopulation = startPopulation;
  slot.age = 0;
  slot.version++;
}

/** Ages every label by `dt` seconds and retires the old ones. */
export function advanceDeathLabels(dt: number): void {
  for (const l of deathLabels) {
    if (!l.active) continue;
    l.age += dt;
    if (l.age >= LABEL_SECONDS) l.active = false;
  }
}

export function clearDeathLabels(): void {
  for (const l of deathLabels) l.active = false;
}

/** The DOM nodes of the pooled labels (set by the DeathLabels component). */
export const deathLabelEls: (HTMLElement | null)[] = Array.from(
  { length: MAX_LABELS },
  () => null
);
