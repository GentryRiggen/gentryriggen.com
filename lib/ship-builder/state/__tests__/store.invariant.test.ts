import { act } from "react";
import { openAttachPoints } from "../../model/attach";
import { getPartDef } from "../../model/catalog";
import {
  buildOccupancy,
  CELLS_PER_SEGMENT,
  GRID_WIDTH,
  gridLength,
  MAX_LEVEL,
  MAX_SEGMENTS,
  topLevel,
} from "../../model/grid";
import { validateShip } from "../../model/placement";
import { PART_TYPES, type Anchor, type PartType } from "../../model/types";
import { createInitialState, useShipBuilderStore } from "../store";

const SEQUENCES = 300;
const ACTIONS_PER_SEQUENCE = 40;
const SEED = 0x5eed;

/** Small deterministic PRNG so failures reproduce from the seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Random = () => number;

const int = (random: Random, min: number, max: number) =>
  min + Math.floor(random() * (max - min + 1));

function pick<T>(random: Random, items: readonly T[]): T | undefined {
  return items.length === 0
    ? undefined
    : items[int(random, 0, items.length - 1)];
}

const store = () => useShipBuilderStore.getState();

function anchorFor(random: Random, type: PartType): Anchor | undefined {
  const def = getPartDef(type);
  if (def.placement === "grid") {
    const { ship } = store();
    if (random() < 0.3) {
      // Anywhere in the widest grid, mostly rejected.
      return {
        kind: "grid",
        level: int(random, 0, MAX_LEVEL),
        x: int(random, 0, MAX_SEGMENTS * CELLS_PER_SEGMENT - 1),
        z: int(random, 0, GRID_WIDTH - 1),
      };
    }
    // On top of whatever stands at an in-bounds column, often accepted.
    const x = int(random, 0, gridLength(ship) - 1);
    const z = int(random, 0, GRID_WIDTH - 1);
    const level = topLevel(buildOccupancy(ship), x, z) + 1;
    return { kind: "grid", level, x, z };
  }
  const open = pick(random, openAttachPoints(store().ship, def));
  return open
    ? { kind: "attach", parentId: open.parentId, pointId: open.point.id }
    : undefined;
}

type Action = { name: string; run: (random: Random) => string };

const ACTIONS: Action[] = [
  {
    name: "place",
    run(random) {
      const type = pick(random, PART_TYPES)!;
      store().selectTool(type);
      // selectTool toggles off when the same tool is chosen twice.
      if (store().tool.kind !== "place") store().selectTool(type);
      // selectTool resets rotation, so rotate here to reach rotated footprints.
      for (let turns = int(random, 0, 3); turns > 0; turns--) store().rotate();
      const anchor = anchorFor(random, type);
      if (!anchor) return `place ${type} (nowhere)`;
      store().placeAt(anchor);
      return `place ${type} ${JSON.stringify(anchor)}`;
    },
  },
  { name: "rotate", run: () => (store().rotate(), "rotate") },
  {
    name: "delete",
    run(random) {
      const part = pick(random, store().ship.parts);
      if (!part) return "delete (empty)";
      store().select(part.id);
      store().requestDelete();
      if (store().pendingRemoval) store().confirmRemoval();
      return `delete ${part.id}`;
    },
  },
  {
    name: "hull",
    run(random) {
      const delta = random() < 0.5 ? -1 : 1;
      store().changeHullLength(delta);
      if (store().pendingRemoval) store().confirmRemoval();
      return `hull ${delta}`;
    },
  },
  { name: "undo", run: () => (store().undo(), "undo") },
  { name: "redo", run: () => (store().redo(), "redo") },
  { name: "newShip", run: () => (store().newShip(), "newShip") },
];

/** Placing is weighted up so ships grow tall enough to exercise cascades. */
const WEIGHTED = [
  ...Array.from({ length: 5 }, () => ACTIONS[0]),
  ...ACTIONS.slice(1),
];

describe("store invariant", () => {
  it("every action sequence leaves a valid ship", () => {
    const random = mulberry32(SEED);
    let maxParts = 0;
    for (let sequence = 0; sequence < SEQUENCES; sequence++) {
      act(() => useShipBuilderStore.setState(createInitialState()));
      const log: string[] = [];
      for (let step = 0; step < ACTIONS_PER_SEQUENCE; step++) {
        const action = pick(random, WEIGHTED)!;
        log.push(action.run(random));
        const result = validateShip(store().ship);
        if (!result.ok) {
          throw new Error(
            `Sequence ${sequence} broke the ship: ${result.reason}\n` +
              log.join("\n")
          );
        }
        maxParts = Math.max(maxParts, store().ship.parts.length);
      }
    }
    // Guards against a generator that never builds anything.
    expect(maxParts).toBeGreaterThan(8);
  });
});
