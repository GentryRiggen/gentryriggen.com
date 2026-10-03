import { create } from "zustand";
import { getPartDef } from "../model/catalog";
import { MAX_SEGMENTS, MIN_SEGMENTS } from "../model/grid";
import { newId } from "../model/ids";
import {
  canPlace,
  cascadeIds,
  emptyShip,
  MAX_NAME_LENGTH,
  place,
  previewHullLength,
  removeParts,
  setHullLength,
  type PartCandidate,
  type RuleResult,
} from "../model/placement";
import type { Anchor, PartType, Rotation, Ship } from "../model/types";

export const HISTORY_LIMIT = 100;

export type Tool =
  | { kind: "none" }
  | { kind: "place"; type: PartType; rotation: Rotation };

export type PendingRemoval =
  | { kind: "part"; ids: string[] }
  | { kind: "hull"; lengthSegments: number; ids: string[] };

export interface HoverState {
  candidate: PartCandidate;
  result: RuleResult;
}

export type CameraView = "side" | "top" | "three-quarter";

interface ShipBuilderData {
  ship: Ship;
  savedId: string | null;
  tool: Tool;
  selectedId: string | null;
  hover: HoverState | null;
  pendingRemoval: PendingRemoval | null;
  past: Ship[];
  future: Ship[];
  notice: string | null;
  camera: { view: CameraView; nonce: number };
}

export interface ShipBuilderState extends ShipBuilderData {
  selectTool: (type: PartType) => void;
  cancel: () => void;
  rotate: () => void;
  hoverAt: (anchor: Anchor | null) => void;
  placeAt: (anchor: Anchor) => RuleResult;
  select: (id: string | null) => void;
  requestDelete: () => void;
  confirmRemoval: () => void;
  cancelRemoval: () => void;
  changeHullLength: (delta: number) => void;
  rename: (name: string) => void;
  undo: () => void;
  redo: () => void;
  loadShip: (ship: Ship, savedId: string | null) => void;
  newShip: () => void;
  markSaved: (savedId: string) => void;
  setNotice: (notice: string | null) => void;
  setCameraView: (view: CameraView) => void;
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

const CLEARED = {
  selectedId: null,
  hover: null,
  pendingRemoval: null,
} satisfies Partial<ShipBuilderData>;

export const useShipBuilderStore = create<ShipBuilderState>()((set, get) => {
  function commit(next: Ship, extra: Partial<ShipBuilderData> = {}) {
    const { ship, past } = get();
    set({
      ship: next,
      past: [...past, ship].slice(-HISTORY_LIMIT),
      future: [],
      ...extra,
    });
  }

  return {
    ...createInitialState(),

    selectTool(type) {
      const { tool } = get();
      if (tool.kind === "place" && tool.type === type) {
        set({ tool: { kind: "none" }, hover: null });
        return;
      }
      set({ tool: { kind: "place", type, rotation: 0 }, ...CLEARED });
    },

    cancel() {
      set({ tool: { kind: "none" }, ...CLEARED });
    },

    rotate() {
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
      const { ship, tool } = get();
      set({ hover: anchor ? hoverFor(ship, tool, anchor) : null });
    },

    placeAt(anchor) {
      const { ship, tool } = get();
      const candidate = candidateFor(tool, anchor);
      if (!candidate) return { ok: false, reason: "Pick a part first" };
      const result = place(ship, { id: newId("p"), ...candidate });
      if (!result.ok) return { ok: false, reason: result.reason };
      commit(result.ship, { hover: null });
      return { ok: true };
    },

    select(id) {
      set({ selectedId: id, pendingRemoval: null });
    },

    requestDelete() {
      const { ship, selectedId } = get();
      if (!selectedId) return;
      const ids = cascadeIds(ship, [selectedId]);
      if (ids.length === 1) {
        commit(removeParts(ship, ids), CLEARED);
        return;
      }
      set({ pendingRemoval: { kind: "part", ids } });
    },

    confirmRemoval() {
      const { ship, pendingRemoval } = get();
      if (!pendingRemoval) return;
      const next =
        pendingRemoval.kind === "part"
          ? removeParts(ship, pendingRemoval.ids)
          : setHullLength(ship, pendingRemoval.lengthSegments);
      commit(next, CLEARED);
    },

    cancelRemoval() {
      set({ pendingRemoval: null });
    },

    changeHullLength(delta) {
      const { ship } = get();
      const current = ship.hull.lengthSegments;
      const target = Math.min(
        MAX_SEGMENTS,
        Math.max(MIN_SEGMENTS, current + delta)
      );
      if (target === current) return;
      const ids = target < current ? previewHullLength(ship, target) : [];
      if (ids.length === 0) {
        commit(setHullLength(ship, target), { pendingRemoval: null });
        return;
      }
      set({ pendingRemoval: { kind: "hull", lengthSegments: target, ids } });
    },

    rename(name) {
      set({ ship: { ...get().ship, name: name.slice(0, MAX_NAME_LENGTH) } });
    },

    undo() {
      const { ship, past, future } = get();
      const previous = past.at(-1);
      if (!previous) return;
      set({
        ship: { ...previous, name: ship.name },
        past: past.slice(0, -1),
        future: [ship, ...future],
        ...CLEARED,
      });
    },

    redo() {
      const { ship, past, future } = get();
      const [next, ...rest] = future;
      if (!next) return;
      set({
        ship: { ...next, name: ship.name },
        past: [...past, ship].slice(-HISTORY_LIMIT),
        future: rest,
        ...CLEARED,
      });
    },

    loadShip(ship, savedId) {
      const { camera, notice } = get();
      set({ ...createInitialState(), ship, savedId, camera, notice });
    },

    newShip() {
      commit(emptyShip(), {
        savedId: null,
        tool: { kind: "none" },
        ...CLEARED,
      });
    },

    markSaved(savedId) {
      set({ savedId });
    },

    setNotice(notice) {
      set({ notice });
    },

    setCameraView(view) {
      set({ camera: { view, nonce: get().camera.nonce + 1 } });
    },
  };
});
