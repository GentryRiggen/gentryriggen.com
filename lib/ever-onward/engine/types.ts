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
  /**
   * The running log of things that happened (a storm landed, the nets came
   * in), newest last and capped. Missing on saves from before the log.
   */
  log?: LogEntry[];
  /** Per event source, how many of its events the log has taken in. */
  logSeen?: Record<string, number>;
}

/** One line in the running log. */
export interface LogEntry {
  text: string;
  /** Run seconds when it happened. */
  at: number;
  /** How many story lines had fired by then (orders it among the story). */
  after: number;
  tone: LogTone;
}

export type LogTone = "good" | "bad" | "info";

/**
 * Something that happens again and again (a storm, a haul). Each time `count`
 * goes up, the log takes in `line` as it reads right then.
 */
export interface EventSource {
  id: string;
  count(run: RunState): number;
  line(run: RunState): string | null;
  tone?(run: RunState): LogTone;
}

export interface ResourceDef {
  id: string;
  label: string;
  initial?: number;
  /** Phase ids where it is shown; omitted means always. */
  phases?: readonly string[];
  /**
   * What it is for, in a few plain words ("Spend it to let lights go dark").
   * Shown under the HUD's money and on its tile. Every currency the player
   * earns or spends must have one (a guard test checks).
   */
  purpose?: string;
  /** How its value reads (a percent, a share); omitted: a whole number. */
  format?(value: number): string;
}

/** A made-up state for a cutscene's picture: the phase's scene dressed to show off. */
export interface CutsceneShowcase {
  /** Seconds into the phase (the season, the tide). */
  time?: number;
  owned?: Record<string, number>;
  resources?: Record<string, number>;
}

/** What the little robot does in a shot of an intro film. */
export type RobotMove =
  /** Walks in from the left edge to its spot. */
  | "enter"
  /** Strolls across, from a little left of its spot to it. */
  | "walk"
  /** Stands, breathing and blinking. */
  | "idle"
  /** Tips back to gaze up at something big. */
  | "look-up"
  /** Hops for joy. */
  | "hop"
  /** Waves its free hand. */
  | "wave"
  /** A small, sure nod: decided. */
  | "nod"
  /** Jolts back, eyes wide: wonder or surprise. */
  | "gasp"
  /** Busy hands, working away. */
  | "work"
  /** Lifts the lantern high. */
  | "lift"
  /** Spins once, delighted. */
  | "spin"
  /** Sits and rests, small and still. */
  | "sit"
  /** Walks off to the right edge. */
  | "exit";

/** How the camera moves over the picture during a shot. */
export type CameraMove =
  | "still"
  | "push-in"
  | "pull-out"
  | "pan-left"
  | "pan-right"
  | "tilt-up"
  | "tilt-down"
  | "drift";

/** A little symbol that pops above the robot's head. */
export type RobotEmote = "!" | "?" | "♥" | "…" | "♪" | "✦";

/**
 * One shot of a phase's intro film. The film plays by itself: each shot
 * types its line under the picture, the narrator reads it, the camera moves
 * and the robot acts, then the next shot follows.
 */
export interface CutsceneFrame {
  /** What the narrator says (and the screen types) for this shot. */
  text: string;
  /** The picture from this shot on; later shots keep it unless they set their own. */
  showcase?: CutsceneShowcase;
  /**
   * "title" draws a title card (the universe's name over the stars) instead
   * of the scene; "dark" is a black frame with only the robot, for quiet beats.
   */
  card?: "title" | "dark";
  /** The robot in this shot; omit to leave it out of the picture. */
  robot?: {
    move: RobotMove;
    /** Where it stands, 0 (left edge) to 100 (right edge). Default 30. */
    x?: number;
    emote?: RobotEmote;
    /** Default "right". */
    facing?: "left" | "right";
  };
  /** Default "drift". */
  camera?: CameraMove;
  /** The least time on screen; default from the length of the line. */
  seconds?: number;
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
   * The intro film that plays when the phase begins: a run of shots that
   * follow the little robot into the part, then a closing card with the goal
   * and `tips`. A first phase's film opens on a title card for the universe.
   */
  cutscene?: readonly CutsceneFrame[];
  /** Two or three short, kind, accurate tips, on the film's closing card. */
  tips?: readonly string[];
  /** The resource the free manual action earns here. */
  manualResource: string;
  manualLabel: string;
  /**
   * What a tap does, in a few plain words, finishing "Tap <label> to ..."
   * ("warm the flame. A warm flame lets go faster"). Shown at the start of
   * the part. Required for every phase (a guard test checks).
   */
  tapDoes?: string;
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
   * A short label for a card that changes how you play ("NEW ABILITY"), shown
   * as a badge. Omitted: no badge.
   */
  badge?: string;
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
  /** The resource this bar counts, so the resource tiles can skip it. */
  resourceId?: string;
  /** A line under the bar ("A new gift at 700"). */
  detail?: string;
}

/** One price a project asks: every entry is paid when it starts. */
export interface ProjectCost {
  resource: string;
  amount: number;
}

/**
 * A project (as in Paperclips): a one-off choice paid mostly in a slowly
 * earned second resource (the night's know-how). A few are on offer at a
 * time; each has a visible effect and a trade-off, so which one first is a
 * real choice. New ones reveal on milestones, never on timers, and nothing
 * on offer ever goes away. Done projects are `flags["project-<id>"]`, so an
 * old save simply has none.
 */
export interface ProjectDef {
  id: string;
  /** The phase id it belongs to. */
  phase: string;
  name: string;
  /** What it is and what it trades, in plain words. */
  description: string;
  costs: readonly ProjectCost[];
  /** Offered from the first time this is true (omitted: at once). Must only read. */
  revealWhen?(run: RunState): boolean;
  /** Applies the effect to a draft. */
  onDone?(run: RunState): void;
  /** The visible effect, before to after ("Power/sec 120 -> 144"). Must only read. */
  effectPreview?(run: RunState): string | null;
  /** The catch, in a few words ("Towns want 6% more power"). */
  tradeOff?: string;
  /**
   * Sim hint for an effect income can't show (a better forecast, a bigger
   * battery): added to the forward income gain when bots rank projects.
   */
  botValue?: number;
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

/** A map square as "x,y" (column, row); "0,0" is the top-left start. */
export type SquareKey = string;

/** One small change a map column or row makes to runs played there. */
export interface SquareChange {
  /** Plain words, shown on the square before you step ("Calmer seas"). */
  text: string;
  apply?(run: RunState): void;
}

export type ArtifactTier = "big" | "modest" | "odd";

/** Pixel art: rows of palette keys ("." is empty). */
export type GlyphPalette = Readonly<Record<string, string>>;

/** Something strange on a map square, unknown until a run finishes there. */
export interface ArtifactDef {
  id: string;
  x: number;
  y: number;
  name: string;
  /** What it does, in plain words (shown only once found). */
  effect: string;
  /** The downside, if any. Artifacts with a catch can be switched off. */
  catch?: string;
  tier: ArtifactTier;
  glyph: readonly string[];
  palette: GlyphPalette;
  /** Shapes every fresh run while it is found and switched on. */
  apply(run: RunState): void;
  /**
   * Where it shows in the universe's scene (400 x 300 viewBox), once found.
   * `walk` makes it stroll across the scene instead of floating.
   */
  spot: { x: number; y: number; scale: number; walk?: boolean };
}

export interface MapDef {
  cols: number;
  rows: number;
  /** "The sea chart". */
  title: string;
  /** What a step right is called ("Farther coast"). */
  rightLabel: string;
  /** What a step down is called ("Deeper dream"). */
  downLabel: string;
  /** Per column index: what that column changes. Index 0 changes nothing. */
  columns: readonly SquareChange[];
  /** Per row index: what that row changes. Index 0 changes nothing. */
  rowChanges: readonly SquareChange[];
  artifacts: readonly ArtifactDef[];
  /** Deeper rows tint the scene this colour (the "within" feeling). */
  tint: string;
  /** Shown on the shelf for players who bought the old permanent upgrades. */
  keepsake: { name: string; glyph: readonly string[]; palette: GlyphPalette };
}

/** Saved progress on a universe's map. */
export interface MapState {
  /** The square the current run is played on. */
  at: SquareKey;
  /** Squares a run has been finished on. */
  visited: SquareKey[];
  /** Artifact ids found. */
  found: string[];
  /** Found artifacts the player switched off. */
  off: string[];
  /** A run has been finished on the last square. */
  done?: boolean;
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

/** The big line at the top of the screen: what this part is working toward. */
export interface GoalView {
  /** Short and loud ("LIGHT THE COAST"). */
  label: string;
  current: number;
  target: number;
  /** What the units are ("lighthouses"). */
  unit?: string;
  /** What the next step costs ("Next lighthouse: 4.2K coins"). */
  next?: string;
  /** 0 to 1: how far the next step is filled (the coins saved toward it). */
  progress?: number;
}

/** A meter the player must keep an eye on (the lamp's oil), kept on the HUD. */
export interface GaugeView {
  /** Short and loud ("OIL"). */
  label: string;
  current: number;
  max: number;
  /** Low enough to warn (the bar turns orange). */
  isLow: boolean;
  /** Empty or nearly so (the bar turns red and pulses). */
  isCritical: boolean;
  /** Shown instead of "current / max" (e.g. "72%"). */
  display?: string;
  /** Overrides the LOW / EMPTY word (e.g. "TIRED"); "" shows none. */
  status?: string;
  /** False for a plain amount with nothing to fill (a savings balance). */
  hasBar?: boolean;
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
  /** One-off choices paid in a slow second resource (see `ProjectDef`). */
  projects?: readonly ProjectDef[];
  /** At most this many projects are on offer at once (default 3). */
  maxProjects?: number;
  /**
   * At most this many upgrades the player hasn't bought yet are on offer in a
   * phase; the next one reveals when one is bought. Omitted means no limit.
   */
  maxVisible?: number;
  story: readonly StoryMessage[];
  /** Repeating events that go in the running log (and pop up). */
  events?: readonly EventSource[];
  /** Greyed "someday" cards for upgrades that have not popped in yet. */
  teasers?: readonly TeaserDef[];
  /** Milestone-gated arrivals that wait to be greeted (see `VisitorDef`). */
  visitors?: readonly VisitorDef[];
  /** A countdown bar for the current phase, or null. Must only read. */
  countdown?(run: RunState): CountdownView | null;
  /**
   * The part's goal as a big meter on the HUD, or null when there is none
   * (the screen then looks as it always did). Must only read.
   */
  goalMeter?(run: RunState): GoalView | null;
  /** A big meter kept on the HUD (e.g. the lamp oil), or null. Must only read. */
  gauge?(run: RunState): GaugeView | null;
  /**
   * True while the scene is showing something the player should see
   * unobstructed (a big moment). Pop-ups over the scene wait. Must only read.
   */
  isSceneBusy?(run: RunState): boolean;
  /** A short warning to show right now (e.g. the lamp ran dry), or null. Must only read. */
  alert?(run: RunState): string | null;
  prestige: PrestigeDef;
  /**
   * The prestige map (Paperclips style). When set, it replaces the prestige
   * shop: finished runs step across the map and find artifacts.
   */
  map?: MapDef;
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
  /**
   * Scorecard hook: action ids that are real choices (where to send a crew,
   * which route to fly, which crop to plant, a knob's setting), as opposed to
   * claims, fixes and collects (ride the rush, balance the grid, haul in).
   * The decision-gap metric counts these, meaningful purchases and projects;
   * story lines never count.
   */
  decisionActions?: readonly string[];
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
  /** Progress on the universe's map; missing means the start square. */
  map?: MapState;
}

export interface SaveData {
  version: number;
  universes: Record<string, UniverseSave>;
  seenIntro: boolean;
}
