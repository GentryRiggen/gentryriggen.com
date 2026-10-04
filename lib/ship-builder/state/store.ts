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
import type { SimSea, SimState, TrialInput } from "../sim/types";
import { findTemplate } from "../templates";
import type { HullArea, PaintColor } from "../model/paint";
import type {
  Anchor,
  BowShape,
  Hull,
  PartType,
  Rotation,
  Ship,
  SternShape,
} from "../model/types";

export const HISTORY_LIMIT = 100;

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
 * The sea trial: idle while building, running while the sim plays, then a
 * result until the player goes back to building. Anything but idle freezes the
 * ship: every action that would edit it does nothing (see `isTrialActive`).
 */
export type TrialSlice =
  | { status: "idle" }
  | {
      status: "running";
      input: TrialInput;
      /** Changes per run, so "Try again" restarts the runner. */
      runId: number;
    }
  | { status: "result"; input: TrialInput; state: SimState; runId: number };

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
}

export interface ShipBuilderState extends ShipBuilderData {
  selectTool: (type: PartType) => void;
  /** Enters paint mode with this colour, replacing any placement tool. */
  selectPaint: (color: PaintColor) => void;
  /** Paints a part with the paint tool's colour; the same colour resets it. */
  paintPart: (id: string) => void;
  /** Paints a hull area; the same colour resets it. */
  paintHull: (area: HullArea) => void;
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
  /** Records how the running trial ended; ignored unless one is running. */
  finishTrial: (state: SimState) => void;
  /** Leaves the trial (running or finished) and goes back to building. */
  endTrial: () => void;
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

export const useShipBuilderStore = create<ShipBuilderState>()((set, get) => {
  // Lives outside the state so createInitialState() resets can't reuse ids.
  let noticeId = 0;
  let runId = 0;

  /** True while a trial runs or its result shows: the ship must not change. */
  function isTrialActive(): boolean {
    return get().trial.status !== "idle";
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
      });
    },

    loadShip(ship, savedId, options) {
      if (isTrialActive()) return;
      const {
        camera,
        notice,
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
      });
    },

    newShip(kind) {
      if (isTrialActive()) return;
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
      const { ship } = get();
      const { stats } = analyzeShip(ship);
      const input: TrialInput = {
        ship: simShipFromStats(stats, ship.hull.beam),
        sea,
        ...(impactX === undefined
          ? {}
          : {
              iceberg: {
                compartments: compartmentSpecsOf(ship.hull),
                length: gridLength(ship),
                impactX,
              },
            }),
      };
      runId += 1;
      set({
        trial: { status: "running", input, runId },
        tool: { kind: "none" },
        ...CLEARED,
      });
    },

    finishTrial(state) {
      const { trial } = get();
      if (trial.status !== "running") return;
      set({
        trial: {
          status: "result",
          input: trial.input,
          state,
          runId: trial.runId,
        },
      });
    },

    endTrial() {
      set({ trial: { status: "idle" } });
    },
  };
});
