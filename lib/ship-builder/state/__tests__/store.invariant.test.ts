import { act } from "react";
import { openAttachPoints } from "../../model/attach";
import { getPartDef } from "../../model/catalog";
import {
  beamOf,
  buildOccupancy,
  cellKey,
  CELLS_PER_SEGMENT,
  gridLength,
  isInsideHull,
  MAX_BEAM,
  MAX_LEVEL,
  MAX_SEGMENTS,
  partCells,
  topLevel,
  WING_REACH,
} from "../../model/grid";
import { cascadeIds, validateShip } from "../../model/placement";
import {
  PART_TYPES,
  type Anchor,
  type PartType,
  type Ship,
} from "../../model/types";
import { createInitialState, useShipBuilderStore } from "../store";

const SEQUENCES = 600;
const ACTIONS_PER_SEQUENCE = 40;
const SEED = 0x5ee2;

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

const STEPS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** On top of, or beside, a cell the ship already has. */
function nearExisting(
  random: Random,
  ship: Ship,
  where: "above" | "beside"
): Anchor | undefined {
  const cells = ship.parts.flatMap(partCells);
  // Favour upper levels, where a sideways block is an overhang.
  const upper = cells.filter((cell) => cell.level > 0);
  const from = pick(random, upper.length > 0 && random() < 0.7 ? upper : cells);
  if (!from) return undefined;
  if (where === "above")
    return { kind: "grid", ...from, level: from.level + 1 };
  const [dx, dz] = pick(random, STEPS)!;
  return { kind: "grid", level: from.level, x: from.x + dx, z: from.z + dz };
}

function anchorFor(random: Random, type: PartType): Anchor | undefined {
  const def = getPartDef(type);
  if (def.placement === "grid") {
    const { ship } = store();
    const roll = random();
    if (roll < 0.15) {
      // Anywhere in the widest grid, wings included, mostly rejected.
      return {
        kind: "grid",
        level: int(random, 0, MAX_LEVEL),
        x: int(random, 0, MAX_SEGMENTS * CELLS_PER_SEGMENT - 1),
        z: int(random, -WING_REACH - 1, MAX_BEAM + WING_REACH),
      };
    }
    if (roll < 0.7) {
      // Stack up, or reach out sideways for overhangs, bridges and wings.
      const near = nearExisting(random, ship, roll < 0.4 ? "above" : "beside");
      if (near) return near;
    }
    // On top of whatever stands at a column, wings included, often accepted.
    const x = int(random, 0, gridLength(ship) - 1);
    const z = int(random, -WING_REACH, beamOf(ship) - 1 + WING_REACH);
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
  {
    name: "beam",
    run(random) {
      const delta = random() < 0.5 ? -1 : 1;
      store().changeBeam(delta);
      if (store().pendingRemoval) store().confirmRemoval();
      return `beam ${delta}`;
    },
  },
  { name: "undo", run: () => (store().undo(), "undo") },
  { name: "redo", run: () => (store().redo(), "redo") },
  { name: "newShip", run: () => (store().newShip("liner"), "newShip") },
];

/** Placing is weighted up so ships grow tall enough to exercise cascades. */
const WEIGHTED = [
  ...Array.from({ length: 8 }, () => ACTIONS[0]),
  ...ACTIONS.slice(1),
];

/** Cells that only stand thanks to side support: wings and overhangs. */
function sideSupportedCells(ship: Ship): { wings: number; overhangs: number } {
  const occupancy = buildOccupancy(ship);
  let wings = 0;
  let overhangs = 0;
  for (const cell of ship.parts.flatMap(partCells)) {
    if (!isInsideHull(ship, cell)) wings += 1;
    const below = cellKey({ ...cell, level: cell.level - 1 });
    if (cell.level > 0 && !occupancy.has(below)) overhangs += 1;
  }
  return { wings, overhangs };
}

/** True when the surviving parts no longer keep their relative order. */
function wasReordered(before: Ship, after: Ship): boolean {
  const kept = new Set(after.parts.map((part) => part.id));
  const survivors = before.parts.filter((part) => kept.has(part.id));
  return survivors.some((part, i) => after.parts[i]?.id !== part.id);
}

const REMOVING_ACTIONS = new Set(["delete", "hull", "beam"]);

describe("store invariant", () => {
  it("every action sequence leaves a valid ship", () => {
    const random = mulberry32(SEED);
    let maxParts = 0;
    let wings = 0;
    let overhangs = 0;
    const beams = new Set<number>();
    let reorders = 0;
    for (let sequence = 0; sequence < SEQUENCES; sequence++) {
      act(() => useShipBuilderStore.setState(createInitialState()));
      const log: string[] = [];
      for (let step = 0; step < ACTIONS_PER_SEQUENCE; step++) {
        const action = pick(random, WEIGHTED)!;
        const before = store().ship;
        log.push(action.run(random));
        if (REMOVING_ACTIONS.has(action.name)) {
          reorders += wasReordered(before, store().ship) ? 1 : 0;
        }
        const result = validateShip(store().ship);
        if (!result.ok) {
          throw new Error(
            `Sequence ${sequence} broke the ship: ${result.reason}\n` +
              log.join("\n")
          );
        }
        // Replaying in order can't see a later part undoing an earlier one
        // (a wing block outboard of a davit), so check the finished ship too.
        const dangling = cascadeIds(store().ship, []);
        if (dangling.length > 0) {
          throw new Error(
            `Sequence ${sequence} left parts unsupported: ${dangling}\n` +
              log.join("\n")
          );
        }
        maxParts = Math.max(maxParts, store().ship.parts.length);
        const side = sideSupportedCells(store().ship);
        wings += side.wings;
        overhangs += side.overhangs;
        beams.add(beamOf(store().ship));
      }
    }
    // Guards against a generator that never reaches the interesting states.
    expect(maxParts).toBeGreaterThan(8);
    expect(wings).toBeGreaterThan(100);
    expect(overhangs).toBeGreaterThan(100);
    expect([...beams].sort()).toEqual([3, 4, 5, 6, 7]);
    // A removal that had to move a part behind its new support.
    expect(reorders).toBeGreaterThan(0);
  });
});
