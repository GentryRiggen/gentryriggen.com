/**
 * Ever Onward engine types. A universe is data plus a few small pure
 * functions; the engine owns everything else (buying, phases, story, prestige,
 * saving). RunState is plain JSON so it can be saved and simulated as is.
 *
 * Hooks that receive a `RunState` (tick, manualAction, onBuy, onEnter, apply)
 * get a private draft the engine already cloned: mutate it freely. Predicates
 * (`isDone`, `isComplete`, `visibleWhen`, `when`) must only read.
 */

export interface PhaseTransition {
  from: string;
  to: string;
  /** Run time, in seconds, when the phase changed. */
  at: number;
}

export interface RunState {
  /** Index into `UniverseDef.phases`. */
  phase: number;
  /** Seconds of play in this run (the clock only runs while visible). */
  time: number;
  taps: number;
  complete: boolean;
  resources: Record<string, number>;
  /** Upgrade id to level bought. */
  owned: Record<string, number>;
  /** Numbers a universe or a prestige upgrade sets for the tick to read. */
  mods: Record<string, number>;
  flags: Record<string, boolean>;
  /** Upgrade ids that have popped in; they stay revealed. */
  revealed: string[];
  /** Story message ids, in the order they fired. */
  story: string[];
  /** Every phase change so far; the UI shows a moment for each new one. */
  transitions: PhaseTransition[];
  /** Deterministic RNG state (see rng.ts). */
  rng: number;
}

export interface ResourceDef {
  id: string;
  label: string;
  initial?: number;
  /** Phase ids where it is shown; omitted means always. */
  phases?: readonly string[];
}

/** A made-up state for a cutscene's picture: the phase's scene dressed to show off. */
export interface CutsceneShowcase {
  /** Seconds into the phase (the season, the tide). */
  time?: number;
  owned?: Record<string, number>;
  resources?: Record<string, number>;
}

/** One frame of a phase cutscene. */
export interface CutsceneFrame {
  /** What the narrator says (and the screen shows) for this frame. */
  text: string;
  /** Frame 3 only: short, kind, accurate tips for doing well. */
  tips?: readonly string[];
  /** The picture from this frame on; later frames keep it unless they set their own. */
  showcase?: CutsceneShowcase;
}

export interface PhaseDef {
  id: string;
  title: string;
  /**
   * The opening briefing for this phase: a few short sentences on where the
   * player is, what they do and why it matters. Narrated, with `goal`.
   */
  intro?: string;
  /** One plain-words goal line, shown and read after the intro. */
  goal?: string;
  /**
   * The cutscene that plays when the phase begins: four frames (where you
   * are, what you do and why, how to do well, your goal).
   */
  cutscene?: readonly CutsceneFrame[];
  /** The resource the free manual action earns here. */
  manualResource: string;
  manualLabel: string;
  /** True once the run should move on to the next phase. Ignored in the last. */
  isDone(run: RunState): boolean;
  onEnter?(run: RunState): void;
}

export type UpgradeKind = "mechanic" | "scale" | "filler";

/** A watched number the player must look after (lamp oil). */
export interface ConsumableDef {
  id: string;
  label: string;
  /** 0 (empty) to 1 (full), or null where it does not apply. Must only read. */
  level(run: RunState): number | null;
  /**
   * The levels that count as "low" for the tension metric (default 5% to
   * 30%): the zone where the player feels it and fixes it.
   */
  lowZone?: { lo: number; hi: number };
}

export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  /** Phase ids where it can be bought; omitted means every phase. */
  phases?: readonly string[];
  /** Resource id it costs. */
  currency: string;
  baseCost: number;
  /** Cost is baseCost * costGrowth ^ level. */
  costGrowth: number;
  /** Omitted means one level (a one-off); use Infinity for no cap. */
  maxLevel?: number;
  /** Pops in the first time this is true (omitted: visible at once). */
  visibleWhen?(run: RunState): boolean;
  /** Sim hint: higher is bought first among the affordable. */
  priority?: number;
  /**
   * Scorecard tag: "mechanic" is a new system or action, "scale" a bigger
   * step on something that exists, "filler" a small repeatable. Omitted is
   * "scale". Read only by the simulator and the scorecard.
   */
  kind?: UpgradeKind;
  onBuy?(run: RunState, newLevel: number): void;
  /**
   * A short before-to-after line for the card ("Coins/sec 12 -> 17"), read
   * from the run as it is now. Must only read.
   */
  effectPreview?(run: RunState): string | null;
  /**
   * A short, kind reason shown instead of "X -> X" when the preview would
   * change nothing right now ("A wheelbarrow lets them carry more."). Must
   * only read. Omitted: a generic line is used.
   */
  noEffectReason?(run: RunState): string | null;
}

/** What an action button shows right now. */
export interface ActionView {
  label: string;
  /** A second line (what it does, the state it is in). */
  detail?: string;
  /** Paid from this resource when performed; omitted means free. */
  cost?: { resource: string; amount: number };
  /** True when it can't be done at all right now (a full tank). */
  isBlocked?: boolean;
  /** A short nudge next to the button ("cheap!"). */
  hint?: { text: string; tone: "good" | "bad" | "neutral" };
  /** A resource whose recent history is drawn as a tiny sparkline. */
  trendResource?: string;
}

/**
 * A button besides the tap: a decision the player makes by hand (buy oil).
 * Free or costed, it may be shown only once `isVisible` says so.
 */
export interface ActionDef {
  id: string;
  /** Phase ids where it can be used; omitted means every phase. */
  phases?: readonly string[];
  /**
   * True when a panel of its own draws the button (the weather desk), so the
   * generic action list leaves it out. It still counts as an action.
   */
  isInline?: boolean;
  /** Pops in the first time this is true (omitted: visible at once). */
  visibleWhen?(run: RunState): boolean;
  /** Must only read. */
  describe(run: RunState): ActionView;
  /**
   * Applies the effect to a draft; the engine has already taken the cost, and
   * says how much it took (`paid`), so an action priced by what it gives
   * (a tank filled with whatever the coins can buy) needs no second guess.
   */
  perform(run: RunState, paid: number): void;
}

export interface StoryMessage {
  id: string;
  text: string;
  /** Only fires while this phase is current. */
  phase?: string;
  /** Fires once, the first time this is true (omitted: on entering). */
  when?(run: RunState): boolean;
}

/**
 * A greyed "someday" card: it hints at an upgrade that has not popped in yet,
 * so the shop is never a blank page and the player has something to look
 * forward to. It goes away the moment the upgrade pops in.
 */
export interface TeaserDef {
  /** The upgrade it hints at (must be one of the universe's upgrades). */
  upgradeId: string;
  /**
   * The phase it is shown in, when that is not the upgrade's own (a hint at
   * what the next part holds). Omitted: the upgrade's own phase.
   */
  phase?: string;
  /** What the card is called, when the upgrade's name would give it away. */
  name?: string;
  /** Shown from the moment this is true (omitted: from the phase start). */
  showWhen?(run: RunState): boolean;
  /** What has to happen first, in plain words. Must only read. */
  hint(run: RunState): string;
}

/**
 * A gentle one-off arrival: it shows up when a milestone is reached (never a
 * timer), waits as long as it takes until the player greets it, gives a small
 * gift, and is kept in a logbook. Nothing about it can be missed or lost.
 * Its line is the story message with the same id, which fires on arrival
 * (`flags["here-<id>"]` is true then).
 */
export interface VisitorDef {
  id: string;
  /** Phase id where it can arrive. */
  phase: string;
  /** Short title for its card and the logbook ("A mail boat"). */
  name: string;
  /** Arrives the first time this is true. Must only read. */
  arrivesWhen(run: RunState): boolean;
  /** What the gift is, in plain words, read from the run. Must only read. */
  giftText(run: RunState): string;
  /** Gives the gift to a draft. */
  give(run: RunState): void;
}

/** A bar counting down toward something (stars left until the next gift). */
export interface CountdownView {
  label: string;
  /** What is left, and what there was at the start. */
  value: number;
  max: number;
  /** Values (on the same scale) where something happens, drawn as ticks. */
  marks?: readonly number[];
  /** A line under the bar ("A new gift at 700"). */
  detail?: string;
}

export interface PrestigeUpgradeDef {
  id: string;
  name: string;
  description: string;
  /** Embers for level 1. */
  cost: number;
  /** Cost multiplier per level; default 1.5. */
  costGrowth?: number;
  maxLevel: number;
  /** Shapes a fresh run (set mods, add starting resources, ...). */
  apply(run: RunState, level: number): void;
}

export interface PrestigeDef {
  /** Plural display name of the prestige currency; "Embers" when unset. */
  label?: string;
  /** Singular of `label` ("Acorn"); the plural minus a trailing "s" when unset. */
  labelSingular?: string;
  /** Embers for finishing the universe. */
  completionEmbers: number;
  /** Embers for each phase cleared (kept when restarting from phase 2+). */
  phaseEmbers: number;
  upgrades: readonly PrestigeUpgradeDef[];
}

export interface UniverseDef {
  id: string;
  title: string;
  /** One-line goal shown on the hub card. */
  goal: string;
  /**
   * The universe opens once the player has finished another one (any
   * `completions > 0`, which a restart never takes away). `hint` is shown on
   * the locked hub card.
   */
  requires?: { universeId: string; hint: string };
  resources: readonly ResourceDef[];
  phases: readonly PhaseDef[];
  upgrades: readonly UpgradeDef[];
  /** Hand-made decisions besides the tap and the shop. */
  actions?: readonly ActionDef[];
  /**
   * At most this many upgrades the player hasn't bought yet are on offer in a
   * phase; the next one reveals when one is bought. Omitted means no limit.
   */
  maxVisible?: number;
  story: readonly StoryMessage[];
  /** Greyed "someday" cards for upgrades that have not popped in yet. */
  teasers?: readonly TeaserDef[];
  /** Milestone-gated arrivals that wait to be greeted (see `VisitorDef`). */
  visitors?: readonly VisitorDef[];
  /** A countdown bar for the current phase, or null. Must only read. */
  countdown?(run: RunState): CountdownView | null;
  /** A short warning to show right now (e.g. the lamp ran dry), or null. Must only read. */
  alert?(run: RunState): string | null;
  prestige: PrestigeDef;
  /** Continuous production; dt is seconds, already clamped. */
  tick(run: RunState, dt: number): void;
  /**
   * Continuous costs, per second, of resources the player earns (lamp oil
   * paid in coins). Used for the net rate; never applied by the engine.
   */
  upkeep?(run: RunState): Record<string, number>;
  /**
   * Scorecard hook: ids of the systems that offer or want the player's
   * attention right now ("tap", "oilMarket", "storm"). Must only read.
   */
  plates?(run: RunState): string[];
  /**
   * Scorecard hook: plate id to the action ids that tend it. A plate listed
   * here only counts as spinning while the player has done one of its actions
   * in the last 90 seconds (attention events, not a dial under a line); a
   * plate not listed counts whenever `plates` offers it.
   */
  plateActions?: Readonly<Record<string, readonly string[]>>;
  /** Scorecard hook: watched numbers with a refill (see `ConsumableDef`). */
  consumables?: readonly ConsumableDef[];
  /**
   * Scorecard hook: the run as the simulator's income probes should see it,
   * with one-off windfalls taken out (a storm's payout is not income; a
   * claimed bonus is already left out because it needs an action). Must only
   * read; return a copy (see `cloneRun`) or the run itself when nothing needs
   * to change.
   */
  incomeView?(run: RunState): RunState;
  /**
   * Scorecard hook: true when the scene a player sees differs between the two
   * runs (a new lighthouse, a light let go). Must only read.
   */
  sceneDiff?(before: RunState, after: RunState): boolean;
  /** The free tap. Must earn the phase's manualResource whatever the state. */
  manualAction(run: RunState): void;
  /** Read in the last phase: true ends the run. */
  isComplete(run: RunState): boolean;
}

export interface UniverseSave {
  run: RunState;
  /** Fastest completion, in run seconds. */
  best: number | null;
  completions: number;
  embers: number;
  /** Prestige upgrade id to level. */
  prestigeUpgrades: Record<string, number>;
  /**
   * The "you can restart for embers" card has been shown and answered. Per
   * universe, so a restart does not bring it back. Missing in older saves
   * (read as false).
   */
  hasSeenEmberTip?: boolean;
}

export interface SaveData {
  version: number;
  universes: Record<string, UniverseSave>;
  seenIntro: boolean;
}
