import { create } from "zustand";
import { analyzeShip } from "../model/analysis";
import { getPartDef } from "../model/catalog";
import { cycleBulkhead } from "../model/bulkheads";
import {
  gridLength,
  MAX_BEAM,
  MAX_SEGMENTS,
  MIN_BEAM,
  MIN_SEGMENTS,
} from "../model/grid";
import type { FunnelPaint } from "../model/funnelLivery";
import { newId } from "../model/ids";
import {
  canPlace,
  cascadeIds,
  clampName,
  emptyShip,
  place,
  previewHullSize,
  removeParts,
  setHullSize,
  type HullSize,
  type PartCandidate,
  type RuleResult,
} from "../model/placement";
import type { ShipKind } from "../model/kinds";
import { compartmentSpecsOf } from "../sim/compartments";
import { simShipFromStats } from "../sim/simShip";
import { trialFunnelsOf } from "../sim/trialFunnels";
import { isTimelineTrial, trialKindOf } from "../sim/trialKind";
import type {
  BreakMode,
  LifeboatMode,
  SimSea,
  SimState,
  TrialInput,
} from "../sim/types";
import { trackGame } from "@/lib/analytics/trackGame";
import {
  trackPartPlaced,
  trackTemplateUsed,
  trackTrialRun,
} from "../analytics";
import { findTemplate } from "../templates";
import { decidingSea, shipshapeRuns } from "../challenges/score";
import {
  giveUpSmooth,
  NEW_SMOOTH_RUN,
  type SmoothRun,
} from "../challenges/smooth";
import {
  challengeDef,
  CHALLENGE_STRIKE_FRACTION,
  SMOOTH_FIELD,
  type ChallengeId,
} from "../challenges/definitions";
import { forgetUnsavedChallenges } from "@/lib/ship-builder/challenges/progressStore";
import { getSeaState } from "../../../components/ship-builder/hooks/useSeaState";
import { getTimeOfDay } from "../../../components/ship-builder/hooks/useTimeOfDay";
import { getTrialChoices } from "../../../components/ship-builder/hooks/useTrialChoices";
import { trialSpeedSetting } from "../../../components/ship-builder/hooks/useTrialSpeed";
import type { TimeOfDay } from "../../../components/ship-builder/scene/timeOfDay";
import { isSeaState } from "../../../components/ship-builder/scene/seaState";
import type { DriveConfig, DriveView } from "../sail/driveConfig";
import type { SailImpact } from "../sail/types";
import { publishSail } from "./sailLive";
import { publishSmooth } from "./smoothLive";
import { resetSailInput } from "./sailInput";
import { spawnOf, type WalkStart } from "../walk";
import { publishWalk } from "./walkLive";
import { resetEscape } from "./escapeLive";
import type { EscapeBoatKind, EscapeEnding } from "../walk/escape";
import { resetWalkInput } from "./walkInput";
import type { HullArea, PaintColor } from "../model/paint";
import {
  isFunnelType,
  type FunnelArea,
  type FunnelMark,
} from "../model/funnelLivery";
import type {
  Anchor,
  BowShape,
  Hull,
  PartType,
  PlacedPart,
  Rotation,
  Ship,
  SternShape,
} from "../model/types";

export const HISTORY_LIMIT = 100;

/**
 * Where "Hit with an iceberg" strikes her: this share of her length from the bow.
 * Near the bow is where the Titanic's hull is opened enough to sink her
 * (further aft she stays afloat). Well-built ships may still survive; that is
 * the sim.
 */
const SINK_IMPACT_FRACTION = 0.2;

export type Tool =
  | { kind: "none" }
  | { kind: "place"; type: PartType; rotation: Rotation }
  | { kind: "paint"; color: PaintColor };

export type PendingRemoval =
  | { kind: "part"; ids: string[] }
  | { kind: "hull"; lengthSegments: number; beam: number; ids: string[] };

export interface HoverState {
  candidate: PartCandidate;
  result: RuleResult;
}

export type CameraView = "side" | "top" | "three-quarter" | "below";

export interface Notice {
  text: string;
  id: number;
}

/**
 * Drive mode: idle while building, `setup` while the obstacle picker is open,
 * `sailing` while the player steers. Both non-idle states freeze the ship.
 */
export type DriveSlice =
  | { status: "idle" }
  | { status: "setup" }
  | { status: "sailing"; config: DriveConfig; runId: number; view: DriveView };

/**
 * Walk mode: idle while building, `walking` while the player strolls the decks
 * in first person. Like a drive it freezes the ship.
 */
export type WalkSlice =
  { status: "idle" } | { status: "walking"; runId: number };

/**
 * How a challenge sail ended, shown on a card until the player goes back to
 * building or tries again. The sail itself is over by then (`drive` is idle).
 */
export interface SailResult {
  challenge: ChallengeId;
  run: SmoothRun;
  runId: number;
}

/**
 * How the scene looks during a trial: its sea and time of day. The scene
 * shows these instead of the main-screen choices while the trial is on
 * (aiming, running or its result), and never changes those choices. Scene
 * only: the sim reads `input.sea`, never this.
 */
export interface TrialLook {
  sea: SimSea;
  time: TimeOfDay;
}

/** The main-screen sea and time, the look a trial gets by default. */
function mainLook(): TrialLook {
  return { sea: getSeaState(), time: getTimeOfDay() };
}

/** The trials that open a setup card with a Go button. */
export type SetupKind = "waves" | "storm";

/**
 * The sea trial: idle while building, `setup` while a Waves or Shipwreck
 * storm card is open, aiming while the player picks where the iceberg hits,
 * running while the sim plays, then a result until the player goes back to
 * building. Anything but idle freezes the ship: every action that would edit
 * it does nothing (see `isTrialActive`).
 *
 * A timeline trial (iceberg or storm) always carries on to the sea floor if
 * she sinks: it starts with `descending` set, so the descent is part of the
 * one run. `replay` plays the same trial again from the start. The result
 * waits until any walker stops walking.
 */
export type TrialSlice =
  | { status: "idle" }
  | { status: "setup"; kind: SetupKind; look: TrialLook }
  | { status: "aiming"; look: TrialLook }
  | {
      status: "running";
      input: TrialInput;
      look: TrialLook;
      /** Changes per run, so "Try again" restarts the runner. */
      runId: number;
      /** The descent to the sea floor is part of this run (timeline trials). */
      descending: boolean;
      /** Set when the trial was started from the Challenges panel. */
      challenge?: ChallengeId;
    }
  | {
      status: "result";
      input: TrialInput;
      look: TrialLook;
      state: SimState;
      runId: number;
      descending: boolean;
      challenge?: ChallengeId;
    };

/** What undo/redo restore: the ship and which My Ships entry it belongs to. */
interface HistoryEntry {
  ship: Ship;
  savedId: string | null;
}

interface ShipBuilderData {
  ship: Ship;
  savedId: string | null;
  tool: Tool;
  selectedId: string | null;
  hover: HoverState | null;
  pendingRemoval: PendingRemoval | null;
  past: HistoryEntry[];
  future: HistoryEntry[];
  /** `id` changes on every setNotice so repeated text restarts and re-announces. */
  notice: Notice | null;
  camera: { view: CameraView; nonce: number };
  trial: TrialSlice;
  drive: DriveSlice;
  sailResult: SailResult | null;
  walk: WalkSlice;
  /**
   * How the player last got off a sinking ship on a walk (a boat from the
   * deck, picked up swimming, or frozen), or null. Set once per walk and
   * cleared when a walk or a trial starts.
   */
  lastEscape: { ending: EscapeEnding; boat: EscapeBoatKind } | null;
  /**
   * How iceberg trials may break the ship. Kept apart from `trial` so it
   * survives leaving a trial; remembered for the session only.
   */
  breakMode: BreakMode;
}

export interface ShipBuilderState extends ShipBuilderData {
  selectTool: (type: PartType) => void;
  /** Enters paint mode with this colour, replacing any placement tool. */
  selectPaint: (color: PaintColor) => void;
  /** Paints a part with the paint tool's colour; the same colour resets it. */
  paintPart: (id: string) => void;
  /** Paints a hull area; the same colour resets it. */
  paintHull: (area: HullArea) => void;
  /** Sets one funnel area ship-wide; null resets it. Body also clears per-funnel `color`. */
  paintFunnels: (area: FunnelArea, color: PaintColor | null) => void;
  /** Sets or clears (null) the mark on one funnel part. Ignores non-funnels. */
  setFunnelMark: (id: string, mark: FunnelMark | null) => void;
  cancel: () => void;
  rotate: () => void;
  hoverAt: (anchor: Anchor | null) => void;
  placeAt: (anchor: Anchor) => RuleResult;
  select: (id: string | null) => void;
  requestDelete: () => void;
  confirmRemoval: () => void;
  cancelRemoval: () => void;
  changeHullLength: (delta: number) => void;
  /** Widens or narrows the ship on the port side. */
  changeBeam: (delta: number) => void;
  /** Reshapes the bow. Parts stay put: shapes only change the hull's ends. */
  setBow: (bow: BowShape) => void;
  setStern: (stern: SternShape) => void;
  /**
   * Taps the wall slot on this segment boundary: none → low → waterline →
   * deck → none. Undoable.
   */
  cycleBulkhead: (at: number) => void;
  rename: (name: string) => void;
  undo: () => void;
  redo: () => void;
  loadShip: (
    ship: Ship,
    savedId: string | null,
    options?: { resetHistory?: boolean }
  ) => void;
  /** Starts a blank ship of this kind. Undoable. */
  newShip: (kind: ShipKind) => void;
  /** Loads a ready-made template as a new, editable ship. Undoable. */
  newShipFromTemplate: (id: string) => void;
  markSaved: (savedId: string) => void;
  setNotice: (text: string | null) => void;
  setCameraView: (view: CameraView) => void;
  /**
   * Starts a sea trial of the current ship in this sea, dropping any tool and
   * selection. Also restarts a finished trial ("Try again"). With `impactX`
   * (cells from the bow) it is an iceberg trial struck there.
   */
  startTrial: (sea: SimSea, impactX?: number) => void;
  /**
   * Opens a trial's setup card (from building or a finished trial): the
   * Waves card on the remembered sea, the storm card in the wild sea, both
   * on the main-screen time. Freezes the ship like a trial.
   */
  openTrialSetup: (kind: SetupKind) => void;
  /**
   * Changes the open card's look (or the aiming iceberg's). The storm keeps
   * its wild sea and the Waves card only takes the main-screen seas. Never
   * touches the main-screen choices.
   */
  setTrialLook: (patch: Partial<TrialLook>) => void;
  /** Closes the setup card and goes back to building. */
  cancelTrialSetup: () => void;
  /** Go: starts the open card's trial with its look (and lifeboats). */
  startSetupTrial: () => void;
  /** "Try again": runs the finished trial again with the same choices. */
  retryTrial: () => void;
  /**
   * Runs a challenge's own trial (fixed sea, strike and break mode, so the
   * score is fair). Does nothing while walking, or mid-trial or drive.
   */
  startChallenge: (id: ChallengeId) => void;
  /**
   * Ends a challenge sail with how it went (a hit, the finish line, or the
   * player stopping) and shows the result card. Ignored outside one.
   */
  finishSail: (run: SmoothRun) => void;
  /** Closes the sail result card. */
  dismissSailResult: () => void;
  /**
   * Starts aiming an iceberg: freezes building and switches to the side view
   * so the hull can be tapped. Works from building or a finished trial ("Try
   * another spot"); does nothing while a trial runs.
   */
  aimIceberg: () => void;
  /** Backs out of aiming and returns to building. */
  cancelAim: () => void;
  /** Opens the obstacle picker; only from building (no trial, no drive). */
  openDrive: () => void;
  /** Starts sailing with this obstacle field; only from the picker. */
  startDrive: (config: DriveConfig) => void;
  /** Leaves the picker or the drive and goes back to building. */
  endDrive: () => void;
  /**
   * Starts walking the decks from the front, middle (the default) or back of
   * the ship; only from building, and only when the ship has somewhere to
   * stand.
   */
  startWalk: (start?: WalkStart) => void;
  /** Leaves walk mode and goes back to building. */
  stopWalk: () => void;
  /**
   * While walking with no trial on, starts an iceberg trial at a fixed spot
   * and keeps walking; the walk ends when the trial's result arrives.
   */
  sinkWhileWalking: () => void;
  /** Records how the walker escaped; only the first call in a walk counts. */
  recordEscape: (ending: EscapeEnding, boat: EscapeBoatKind) => void;
  setDriveView: (view: DriveView) => void;
  /** A hard hit: ends the drive and plays the sea trial struck where she hit. */
  driveHit: (impact: SailImpact) => void;
  /** Records how the running trial ended; ignored unless one is running. */
  finishTrial: (state: SimState) => void;
  /** Leaves the trial (running or finished) and goes back to building. */
  endTrial: () => void;
  /** Picks how the next iceberg trial may break the ship. */
  setBreakMode: (mode: BreakMode) => void;
  /**
   * "Watch again": plays the finished iceberg trial again from the start,
   * descent included if it was taken.
   */
  replay: () => void;
}

export function createInitialState(): ShipBuilderData {
  return {
    ship: emptyShip(),
    savedId: null,
    tool: { kind: "none" },
    selectedId: null,
    hover: null,
    pendingRemoval: null,
    past: [],
    future: [],
    notice: null,
    camera: { view: "three-quarter", nonce: 0 },
    trial: { status: "idle" },
    drive: { status: "idle" },
    sailResult: null,
    walk: { status: "idle" },
    lastEscape: null,
    breakMode: "real",
  };
}

const NEXT_ROTATION: Record<Rotation, Rotation> = {
  0: 90,
  90: 180,
  180: 270,
  270: 0,
};

function candidateFor(tool: Tool, anchor: Anchor): PartCandidate | null {
  if (tool.kind !== "place") return null;
  const rotation =
    getPartDef(tool.type).placement === "grid" ? tool.rotation : 0;
  return { type: tool.type, anchor, rotation };
}

function hoverFor(ship: Ship, tool: Tool, anchor: Anchor): HoverState | null {
  const candidate = candidateFor(tool, anchor);
  return candidate ? { candidate, result: canPlace(ship, candidate) } : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const CLEARED = {
  selectedId: null,
  hover: null,
  pendingRemoval: null,
} satisfies Partial<ShipBuilderData>;

/** The selection, kept across undo and redo while that part still exists. */
function keptSelection(selectedId: string | null, ship: Ship): string | null {
  return selectedId && ship.parts.some((p) => p.id === selectedId)
    ? selectedId
    : null;
}

export const useShipBuilderStore = create<ShipBuilderState>()((set, get) => {
  // Lives outside the state so createInitialState() resets can't reuse ids.
  let noticeId = 0;
  let runId = 0;

  /** True while a trial or a drive is on: the ship must not change. */
  function isTrialActive(): boolean {
    return (
      get().trial.status !== "idle" ||
      get().drive.status !== "idle" ||
      get().walk.status !== "idle"
    );
  }

  /** Starts the trial (the caller has checked it may); walking is untouched. */
  function beginTrial(
    sea: SimSea,
    impactX?: number,
    options: {
      breakMode?: BreakMode;
      challenge?: ChallengeId;
      /** Cells the gash runs (an iceberg trial); absent is the usual gash. */
      gashLength?: number;
      /** Picks the sea once the ship's input is known (weather challenges). */
      chooseSea?: (input: TrialInput) => SimSea;
      /** The scene's sea and time; absent is the main-screen choices. */
      look?: TrialLook;
      /** A Shipwreck storm (no `impactX`): water over the deck until she sinks. */
      storm?: boolean;
      /** How the crowd boards the boats; absent leaves the input without it. */
      lifeboats?: LifeboatMode;
    } = {}
  ) {
    const { ship } = get();
    const breakMode = options.breakMode ?? get().breakMode;
    const { stats } = analyzeShip(ship);
    const storm =
      options.storm && impactX === undefined
        ? {
            storm: {
              compartments: compartmentSpecsOf(ship.hull),
              length: gridLength(ship),
              breakMode,
            },
          }
        : {};
    const base: TrialInput = {
      ship: simShipFromStats(stats, ship.hull.beam),
      sea,
      length: gridLength(ship),
      funnels: trialFunnelsOf(ship),
      ...(impactX === undefined
        ? {}
        : {
            iceberg: {
              compartments: compartmentSpecsOf(ship.hull),
              length: gridLength(ship),
              impactX,
              breakMode,
              ...(options.gashLength === undefined
                ? {}
                : { gashLength: options.gashLength }),
            },
          }),
      ...storm,
      ...(options.lifeboats ? { lifeboats: options.lifeboats } : {}),
    };
    const input = options.chooseSea
      ? { ...base, sea: options.chooseSea(base) }
      : base;
    runId += 1;
    // Fast-forward is for the run it was picked in; every new run starts at 1x.
    trialSpeedSetting.set(1);
    // A new sinking: any walker starts it aboard.
    resetEscape();
    set({
      lastEscape: null,
      trial: {
        status: "running",
        input,
        look: options.look ?? mainLook(),
        runId,
        descending: true,
        ...(options.challenge ? { challenge: options.challenge } : {}),
      },
      tool: { kind: "none" },
      ...CLEARED,
    });
  }

  /**
   * Pushes a new ship onto history. Hover and any pending removal were
   * computed against the old ship, so they're always dropped.
   */
  function commit(next: Ship, extra: Partial<ShipBuilderData> = {}) {
    const { ship, savedId, past } = get();
    set({
      ship: next,
      past: [...past, { ship, savedId }].slice(-HISTORY_LIMIT),
      future: [],
      hover: null,
      pendingRemoval: null,
      ...extra,
    });
  }

  /**
   * Commits a resize, or asks first when it would remove parts. Growing can
   * remove parts too: a wider beam leaves the old port-edge davits inboard.
   */
  function resizeHull(size: HullSize) {
    const { ship } = get();
    const target = { ...ship.hull, ...size };
    const { lengthSegments, beam } = target;
    if (
      lengthSegments === ship.hull.lengthSegments &&
      beam === ship.hull.beam
    ) {
      return;
    }
    const ids = previewHullSize(ship, target);
    if (ids.length === 0) {
      commit(setHullSize(ship, target));
      return;
    }
    set({ pendingRemoval: { kind: "hull", lengthSegments, beam, ids } });
  }

  return {
    ...createInitialState(),

    selectTool(type) {
      if (isTrialActive()) return;
      const { tool } = get();
      if (tool.kind === "place" && tool.type === type) {
        set({ tool: { kind: "none" }, hover: null });
        return;
      }
      set({ tool: { kind: "place", type, rotation: 0 }, ...CLEARED });
    },

    selectPaint(color) {
      if (isTrialActive()) return;
      set({ tool: { kind: "paint", color }, ...CLEARED });
    },

    paintPart(id) {
      if (isTrialActive()) return;
      const { ship, tool } = get();
      if (tool.kind !== "paint") return;
      const part = ship.parts.find((p) => p.id === id);
      if (!part) return;
      const { color: current, ...rest } = part;
      const painted =
        current === tool.color ? rest : { ...rest, color: tool.color };
      commit({
        ...ship,
        parts: ship.parts.map((p) => (p.id === id ? painted : p)),
      });
    },

    paintHull(area) {
      if (isTrialActive()) return;
      const { ship, tool } = get();
      if (tool.kind !== "paint") return;
      const { [area]: current, ...others } = ship.hull.paint ?? {};
      const paint =
        current === tool.color ? others : { ...others, [area]: tool.color };
      const hull: Hull = { ...ship.hull, paint };
      if (Object.keys(paint).length === 0) delete hull.paint;
      commit({ ...ship, hull });
    },

    paintFunnels(area, color) {
      if (isTrialActive()) return;
      const { ship } = get();
      const current = ship.funnelPaint?.[area] ?? null;
      const hasBodyOverride =
        area === "body" &&
        ship.parts.some((p) => isFunnelType(p.type) && p.color !== undefined);
      if (current === color && !hasBodyOverride) return;
      const funnelPaint: FunnelPaint = { ...ship.funnelPaint };
      if (color === null) delete funnelPaint[area];
      else funnelPaint[area] = color;
      const next: Ship = { ...ship, funnelPaint };
      if (Object.keys(funnelPaint).length === 0) delete next.funnelPaint;
      if (area === "body") {
        next.parts = ship.parts.map((part) => {
          if (!isFunnelType(part.type) || part.color === undefined) return part;
          const cleared = { ...part };
          delete cleared.color;
          return cleared;
        });
      }
      commit(next);
    },

    setFunnelMark(id, mark) {
      if (isTrialActive()) return;
      const { ship } = get();
      const part = ship.parts.find((p) => p.id === id);
      if (!part || !isFunnelType(part.type)) return;
      if (JSON.stringify(part.mark ?? null) === JSON.stringify(mark)) return;
      const updated: PlacedPart = { ...part };
      delete updated.mark;
      if (mark) updated.mark = mark;
      commit({
        ...ship,
        parts: ship.parts.map((p) => (p.id === id ? updated : p)),
      });
    },

    cancel() {
      set({ tool: { kind: "none" }, ...CLEARED });
    },

    rotate() {
      if (isTrialActive()) return;
      const { tool, hover, ship } = get();
      if (tool.kind !== "place" || getPartDef(tool.type).placement !== "grid") {
        return;
      }
      const rotated: Tool = { ...tool, rotation: NEXT_ROTATION[tool.rotation] };
      set({
        tool: rotated,
        hover: hover ? hoverFor(ship, rotated, hover.candidate.anchor) : null,
      });
    },

    hoverAt(anchor) {
      if (isTrialActive()) return;
      const { ship, tool } = get();
      set({ hover: anchor ? hoverFor(ship, tool, anchor) : null });
    },

    placeAt(anchor) {
      if (isTrialActive()) {
        return { ok: false, reason: "Building is paused during the sea trial" };
      }
      const { ship, tool } = get();
      const candidate = candidateFor(tool, anchor);
      if (!candidate) return { ok: false, reason: "Pick a part first" };
      const result = place(ship, { id: newId("p"), ...candidate });
      if (!result.ok) return { ok: false, reason: result.reason };
      commit(result.ship);
      trackPartPlaced(getPartDef(candidate.type).category);
      return { ok: true };
    },

    select(id) {
      if (isTrialActive()) return;
      // A selection and a tool are mutually exclusive, so the bottom pills
      // (Delete, placement hint) never stack: selecting drops the tool.
      set(
        id === null
          ? { selectedId: null, pendingRemoval: null }
          : {
              selectedId: id,
              pendingRemoval: null,
              tool: { kind: "none" },
              hover: null,
            }
      );
    },

    requestDelete() {
      if (isTrialActive()) return;
      const { ship, selectedId } = get();
      if (!selectedId) return;
      const ids = cascadeIds(ship, [selectedId]);
      if (ids.length === 0) {
        set({ selectedId: null });
        return;
      }
      if (ids.length === 1) {
        commit(removeParts(ship, ids), CLEARED);
        return;
      }
      set({ pendingRemoval: { kind: "part", ids } });
    },

    confirmRemoval() {
      if (isTrialActive()) return;
      const { ship, pendingRemoval } = get();
      if (!pendingRemoval) return;
      const next =
        pendingRemoval.kind === "part"
          ? removeParts(ship, cascadeIds(ship, pendingRemoval.ids))
          : setHullSize(ship, {
              lengthSegments: pendingRemoval.lengthSegments,
              beam: pendingRemoval.beam,
            });
      commit(next, CLEARED);
    },

    cancelRemoval() {
      set({ pendingRemoval: null });
    },

    changeHullLength(delta) {
      if (isTrialActive()) return;
      const { lengthSegments } = get().ship.hull;
      resizeHull({
        lengthSegments: clamp(
          lengthSegments + delta,
          MIN_SEGMENTS,
          MAX_SEGMENTS
        ),
      });
    },

    changeBeam(delta) {
      if (isTrialActive()) return;
      const { beam } = get().ship.hull;
      resizeHull({ beam: clamp(beam + delta, MIN_BEAM, MAX_BEAM) });
    },

    setBow(bow) {
      if (isTrialActive()) return;
      const { ship } = get();
      if (ship.hull.bow === bow) return;
      commit(setHullSize(ship, { bow }));
    },

    setStern(stern) {
      if (isTrialActive()) return;
      const { ship } = get();
      if (ship.hull.stern === stern) return;
      commit(setHullSize(ship, { stern }));
    },

    cycleBulkhead(at) {
      if (isTrialActive()) return;
      const { ship } = get();
      const next = cycleBulkhead(ship, at);
      if (next !== ship) commit(next);
    },

    rename(name) {
      set({ ship: { ...get().ship, name: clampName(name) } });
    },

    undo() {
      if (isTrialActive()) return;
      const { ship, savedId, past, future } = get();
      const previous = past.at(-1);
      if (!previous) return;
      set({
        ship: { ...previous.ship, name: ship.name },
        savedId: previous.savedId,
        past: past.slice(0, -1),
        future: [{ ship, savedId }, ...future],
        ...CLEARED,
        selectedId: keptSelection(get().selectedId, previous.ship),
      });
    },

    redo() {
      if (isTrialActive()) return;
      const { ship, savedId, past, future } = get();
      const [next, ...rest] = future;
      if (!next) return;
      set({
        ship: { ...next.ship, name: ship.name },
        savedId: next.savedId,
        past: [...past, { ship, savedId }].slice(-HISTORY_LIMIT),
        future: rest,
        ...CLEARED,
        selectedId: keptSelection(get().selectedId, next.ship),
      });
    },

    loadShip(ship, savedId, options) {
      if (isTrialActive()) return;
      const {
        camera,
        notice,
        breakMode,
        ship: outgoing,
        savedId: outgoingId,
        past,
      } = get();
      const history = options?.resetHistory
        ? { past: [], future: [] }
        : {
            past: [...past, { ship: outgoing, savedId: outgoingId }].slice(
              -HISTORY_LIMIT
            ),
            future: [],
          };
      set({
        ...createInitialState(),
        ...history,
        ship,
        savedId,
        camera,
        notice,
        breakMode,
      });
    },

    newShip(kind) {
      if (isTrialActive()) return;
      forgetUnsavedChallenges();
      commit(emptyShip(kind), {
        savedId: null,
        tool: { kind: "none" },
        ...CLEARED,
      });
    },

    newShipFromTemplate(id) {
      if (isTrialActive()) return;
      const template = findTemplate(id);
      if (!template) return;
      trackTemplateUsed(id);
      forgetUnsavedChallenges();
      commit(template.build(), {
        savedId: null,
        tool: { kind: "none" },
        ...CLEARED,
      });
    },

    markSaved(savedId) {
      set({ savedId });
    },

    setNotice(text) {
      noticeId += 1;
      set({ notice: text === null ? null : { text, id: noticeId } });
    },

    setCameraView(view) {
      set({ camera: { view, nonce: get().camera.nonce + 1 } });
    },

    startTrial(sea, impactX) {
      if (get().walk.status !== "idle") return;
      const { trial } = get();
      // Striking the aimed iceberg keeps the aim card's time and lifeboats.
      const fromAim =
        trial.status === "aiming" && impactX !== undefined
          ? { look: trial.look, lifeboats: getTrialChoices().lifeboats }
          : {};
      beginTrial(sea, impactX, fromAim);
    },

    openTrialSetup(kind) {
      const { trial, drive, walk } = get();
      if (walk.status !== "idle" || drive.status !== "idle") return;
      if (trial.status !== "idle" && trial.status !== "result") return;
      const time = getTimeOfDay();
      const sea: SimSea = kind === "storm" ? "wild" : getTrialChoices().waveSea;
      set({
        trial: { status: "setup", kind, look: { sea, time } },
        tool: { kind: "none" },
        ...CLEARED,
      });
    },

    setTrialLook(patch) {
      const { trial } = get();
      if (trial.status !== "setup" && trial.status !== "aiming") return;
      // Only the Waves card picks a sea, and only a main-screen one.
      const canPickSea =
        trial.status === "setup" &&
        trial.kind === "waves" &&
        isSeaState(patch.sea);
      const look: TrialLook = {
        sea: canPickSea ? (patch.sea ?? trial.look.sea) : trial.look.sea,
        time: patch.time ?? trial.look.time,
      };
      set({ trial: { ...trial, look } });
    },

    cancelTrialSetup() {
      if (get().trial.status !== "setup") return;
      set({ trial: { status: "idle" } });
    },

    startSetupTrial() {
      const { trial, walk } = get();
      if (trial.status !== "setup" || walk.status !== "idle") return;
      if (trial.kind === "waves") {
        beginTrial(trial.look.sea, undefined, { look: trial.look });
        return;
      }
      beginTrial("wild", undefined, {
        look: trial.look,
        storm: true,
        lifeboats: getTrialChoices().lifeboats,
      });
    },

    retryTrial() {
      const { trial, walk } = get();
      if (trial.status !== "result" || walk.status !== "idle") return;
      // Building is frozen while the result shows, so the same input is the
      // same ship: run it again with the same look.
      runId += 1;
      set({
        trial: {
          status: "running",
          input: trial.input,
          look: trial.look,
          runId,
          descending: trial.descending,
          ...(trial.challenge ? { challenge: trial.challenge } : {}),
        },
      });
    },

    startChallenge(id) {
      const { trial, drive, walk } = get();
      if (walk.status !== "idle" || drive.status !== "idle") return;
      if (trial.status !== "idle" && trial.status !== "result") return;
      const { trial: def } = challengeDef(id);
      if (def.kind === "sail") {
        runId += 1;
        resetSailInput();
        publishSail(null);
        // Before the first frame, so the HUD never shows the last run.
        publishSmooth(NEW_SMOOTH_RUN);
        set({
          trial: { status: "idle" },
          sailResult: null,
          drive: {
            status: "sailing",
            config: { ...SMOOTH_FIELD, challenge: id },
            runId,
            view: "chase",
          },
          tool: { kind: "none" },
          ...CLEARED,
        });
        return;
      }
      const impactX =
        def.kind === "iceberg"
          ? gridLength(get().ship) * CHALLENGE_STRIKE_FRACTION
          : undefined;
      if (def.kind === "waves") {
        // Play the trial that decides the score (see `decidingSea`).
        beginTrial(def.sea, undefined, {
          challenge: id,
          chooseSea: (input) => decidingSea(shipshapeRuns(input)),
        });
        return;
      }
      beginTrial(def.sea, impactX, {
        challenge: id,
        breakMode: def.breakMode,
        ...(def.isWholeHull ? { gashLength: gridLength(get().ship) } : {}),
      });
    },

    finishSail(run) {
      const { drive } = get();
      if (drive.status !== "sailing" || !drive.config.challenge) return;
      const final = giveUpSmooth(run);
      get().endDrive();
      set({
        sailResult: {
          challenge: drive.config.challenge,
          run: final,
          runId: drive.runId,
        },
      });
    },

    dismissSailResult() {
      set({ sailResult: null });
    },

    sinkWhileWalking() {
      if (get().walk.status !== "walking") return;
      if (get().trial.status !== "idle") return;
      beginTrial(getSeaState(), gridLength(get().ship) * SINK_IMPACT_FRACTION, {
        lifeboats: getTrialChoices().lifeboats,
      });
    },

    openDrive() {
      if (isTrialActive()) return;
      set({ drive: { status: "setup" }, tool: { kind: "none" }, ...CLEARED });
    },

    startDrive(config) {
      if (get().drive.status !== "setup") return;
      trackGame("drive_started", { density: config.density });
      runId += 1;
      resetSailInput();
      publishSail(null);
      set({
        drive: { status: "sailing", config, runId, view: "chase" },
      });
    },

    endDrive() {
      if (get().drive.status === "idle") return;
      resetSailInput();
      publishSail(null);
      set({ drive: { status: "idle" } });
    },

    startWalk(start = "middle") {
      const { trial, drive, walk } = get();
      if (drive.status !== "idle" || walk.status !== "idle") return;
      // She can be walked while a trial runs, not while it is aiming or done.
      if (trial.status !== "idle" && trial.status !== "running") return;
      const spawn = spawnOf(get().ship, undefined, start);
      if (spawn === null) return;
      trackGame("walk_started", { start });
      runId += 1;
      resetWalkInput();
      publishWalk(spawn);
      resetEscape();
      set({
        lastEscape: null,
        walk: { status: "walking", runId },
        tool: { kind: "none" },
        ...CLEARED,
      });
    },

    stopWalk() {
      if (get().walk.status === "idle") return;
      resetWalkInput();
      publishWalk(null);
      resetEscape();
      set({ walk: { status: "idle" } });
    },

    recordEscape(ending, boat) {
      if (get().walk.status !== "walking" || get().lastEscape) return;
      set({ lastEscape: { ending, boat } });
    },

    setDriveView(view) {
      const { drive } = get();
      if (drive.status !== "sailing") return;
      set({ drive: { ...drive, view } });
    },

    driveHit(impact) {
      if (get().drive.status !== "sailing") return;
      get().endDrive();
      if (get().walk.status !== "idle") return;
      // No card: the main-screen look and the remembered lifeboats.
      beginTrial(getSeaState(), impact.impactX, {
        lifeboats: getTrialChoices().lifeboats,
      });
    },

    aimIceberg() {
      if (get().walk.status !== "idle") return;
      const { trial } = get();
      if (trial.status !== "idle" && trial.status !== "result") return;
      // "Try another spot" keeps the iceberg card's look (a Night pick stays
      // Night); a fresh aim starts from the main screen.
      const look =
        trial.status === "result" && trial.input.iceberg
          ? trial.look
          : mainLook();
      set({
        trial: { status: "aiming", look },
        tool: { kind: "none" },
        camera: { view: "side", nonce: get().camera.nonce + 1 },
        ...CLEARED,
      });
    },

    cancelAim() {
      if (get().trial.status !== "aiming") return;
      set({ trial: { status: "idle" } });
    },

    finishTrial(state) {
      const { trial } = get();
      if (trial.status !== "running") return;
      const kind = trialKindOf(trial.input);
      trackTrialRun(
        state,
        trial.input.sea,
        kind === "waves" ? "weather" : kind
      );
      set({
        trial: {
          status: "result",
          input: trial.input,
          look: trial.look,
          state,
          runId: trial.runId,
          descending: trial.descending,
          ...(trial.challenge ? { challenge: trial.challenge } : {}),
        },
      });
    },

    endTrial() {
      // With no trial there is no sinking: a walker in the water or a boat
      // is back on deck.
      resetEscape();
      set({ trial: { status: "idle" } });
    },

    setBreakMode(mode) {
      set({ breakMode: mode });
    },

    replay() {
      const { trial } = get();
      if (trial.status !== "result" || !isTimelineTrial(trial.input)) return;
      runId += 1;
      trialSpeedSetting.set(1);
      set({
        trial: {
          status: "running",
          input: trial.input,
          look: trial.look,
          runId,
          descending: trial.descending,
          ...(trial.challenge ? { challenge: trial.challenge } : {}),
        },
      });
    },
  };
});
