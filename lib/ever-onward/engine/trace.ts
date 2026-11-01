/**
 * What the simulator records for the Engagement Scorecard (see
 * docs/superpowers/specs/2026-11-01-ever-onward-engagement-research.md,
 * section 5). Plain data; `score.ts` turns it into numbers.
 */
import type { UpgradeKind } from "./types";

/** A purchase or unlock counts as "something" only if it is felt. */
export const MEANINGFUL_EFFECT = 0.1;

export interface Effect {
  /** Change in income (net per second) the purchase makes, as a ratio. */
  effectRatio: number;
  /** The scene the player sees changed. */
  sceneChanged: boolean;
  kind: UpgradeKind;
}

/** Meaningful: >= 10% more income, OR a new mechanic, OR the scene changed. */
export const isMeaningful = ({
  effectRatio,
  sceneChanged,
  kind,
}: Effect): boolean =>
  effectRatio >= MEANINGFUL_EFFECT || kind === "mechanic" || sceneChanged;

/** Seconds a soft beat must stand clear of the beat before it. */
export const SOFT_BEAT_GAP = 30;
/** A teaser counts only if it was on show this long before it unlocked. */
export const TEASER_MIN_SECONDS = 30;

export interface OptionView extends Effect {
  id: string;
  cost: number;
  currency: string;
  /** The card's before-to-after line, when the upgrade has one. */
  effect: string | null;
  meaningful: boolean;
}

export interface TraceSample {
  t: number;
  phase: number;
  /** Seconds since the current phase began (the click curve is per phase). */
  sinceEntry: number;
  /** Resources shown in the current phase. */
  resources: Record<string, number>;
  /** Gross income per second of the phase's main resource with zero taps. */
  autoRate: number;
  /** Income per second from tapping at the bot's current rate. */
  manualRate: number;
  /** Continuous costs per second (lamp oil), in the same resource. */
  upkeep: number;
  tapsPerSecond: number;
  /** Visible, not maxed upgrades. */
  visible: string[];
  /** Visible and affordable now. */
  affordable: OptionView[];
  /** Visible, not maxed and not affordable yet: the next goals. */
  goals: OptionView[];
  /** Upgrade ids hinted at by greyed "someday" cards on show right now. */
  teasers: string[];
  cheapestVisibleCost: number | null;
  /** Seconds until the cheapest unaffordable meaningful goal is affordable. */
  waitEstimate: number | null;
  /** Consumable id to 0..1 (null where it does not apply). */
  consumables: Record<string, number | null>;
  /** Live systems right now. */
  plates: string[];
}

export interface PurchaseRecord extends Effect {
  t: number;
  id: string;
  level: number;
  phase: number;
  cost: number;
  currency: string;
  /** Amount of the currency just before buying. */
  currencyBefore: number;
  incomeBefore: number;
  incomeAfter: number;
  meaningful: boolean;
  /** Seconds since the previous purchase (or the run start). */
  sinceLastPurchase: number;
  /** Seconds this was affordable before the bot bought it. */
  waitedFor: number;
}

export type NoveltyKind =
  | "upgrade"
  | "resource"
  | "action"
  | "scene"
  | "phase"
  | "story"
  | "plate"
  | "teaser"
  | "visitor";

export interface NoveltyEvent {
  t: number;
  kind: NoveltyKind;
  id: string;
  /** For "upgrade": its tag. */
  upgradeKind?: UpgradeKind;
  /**
   * A soft beat (a teaser seen for a while, a later step that changes the
   * scene) only counts when it is at least `SOFT_BEAT_GAP` seconds from the
   * beat before it, so piling them up can't pad the reveal cadence.
   */
  isSoft?: boolean;
}

export interface PhaseSpan {
  id: string;
  index: number;
  start: number;
  end: number;
}

export interface Trace {
  sampleEvery: number;
  samples: TraceSample[];
  purchases: PurchaseRecord[];
  novelty: NoveltyEvent[];
  phases: PhaseSpan[];
}
