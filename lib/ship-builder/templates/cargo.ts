import type { Ship } from "../model/types";
import { ShipBuilder, range } from "./modernBuilder";
import type { ShipTemplate } from "./types";

/** Container levels stacked on hatch covers (the grid has levels 0-3). */
const TALL_STACK = [1, 2, 3];
const LOW_STACK = [1, 2];

interface Bay {
  /** First x of the bay; hatch covers and containers are two cells long. */
  x: number;
  /** How many two-cell slots the bay holds. */
  slots: number;
  /** Which levels get containers. */
  levels: readonly number[];
}

/**
 * Hatch covers over the lanes in `lanes` (each two cells wide) with
 * containers stacked on top, plus a single column of containers on the main
 * deck for a beam that doesn't divide into pairs.
 */
function loadBay(
  b: ShipBuilder,
  bay: Bay,
  lanes: readonly number[],
  spareRow?: number
): void {
  const coveredRows = lanes.flatMap((z) => [z, z + 1]);
  const stackRows =
    spareRow === undefined ? coveredRows : [...coveredRows, spareRow];
  for (let slot = 0; slot < bay.slots; slot++) {
    const x = bay.x + slot * 2;
    for (const z of lanes) b.grid("hatch-cover", 0, x, z);
    if (spareRow !== undefined) b.grid("container", 0, x, spareRow);
    for (const level of bay.levels) {
      for (const z of stackRows) b.grid("container", level, x, z);
    }
  }
}

/** Ever Given: a huge container ship with the bridge far aft. */
function buildEverGiven(): Ship {
  const b = new ShipBuilder("cargo", "Ever Given", 20, 7);
  const lanes = [0, 2, 4];
  const sides = [0, 6];

  loadBay(b, { x: 4, slots: 16, levels: TALL_STACK }, lanes, 6);
  loadBay(b, { x: 44, slots: 5, levels: TALL_STACK }, lanes, 6);

  // The deckhouse: crew quarters, then a deck for the funnel, then the bridge.
  b.cells("cabin-crew", 0, 38, 42, range(0, 7));
  b.cells("cabin-crew", 1, 38, 42, range(0, 7));
  b.cells("deck-1x1", 2, 40, 42, range(1, 6));
  b.grid("bridge-7", 3, 40, 0);
  // Twin uptakes either side of the centreline.
  b.onTop("funnel-modern", 2, 41, 2);
  b.onTop("funnel-modern", 2, 41, 4);

  // The stern deck holds the lifeboat stations.
  b.decks(0, 54, 60, range(0, 7));

  for (const z of sides) {
    for (const x of range(38, 42)) b.boat("lifeboat-standard", 1, x, z);
    for (const x of range(54, 60)) b.boat("lifeboat-standard", 0, x, z);
  }
  b.hull("lifeboat-freefall", "freefall");

  b.hull("propeller", "prop:1");
  b.hull("propeller", "prop:2");
  b.hull("rudder", "rudder");
  return b.build();
}

/** A small feeder ship that carries boxes between big ports and small ones. */
function buildFeeder(): Ship {
  const b = new ShipBuilder("cargo", "Little Hopper", 10, 4);
  const lanes = [0, 2];

  loadBay(b, { x: 2, slots: 5, levels: LOW_STACK }, lanes);
  loadBay(b, { x: 14, slots: 4, levels: LOW_STACK }, lanes);

  // Two cranes on bare hatch covers between the bays.
  for (const z of lanes) {
    b.grid("hatch-cover", 0, 12, z);
    b.onTop("cargo-crane", 0, 12, z);
  }

  b.cells("cabin-crew", 0, 23, 28, [1, 2]);
  b.decks(0, 23, 30, [0, 3]);
  b.decks(0, 28, 30, [1, 2]);
  b.decks(1, 23, 28, range(0, 4));
  b.grid("bridge", 2, 23, 0);
  b.onTop("funnel-modern", 1, 25, 2);

  for (const z of [0, 3]) {
    for (const x of range(25, 28)) b.boat("lifeboat-standard", 1, x, z);
    for (const x of range(28, 30)) b.boat("lifeboat-standard", 0, x, z);
  }
  b.hull("lifeboat-freefall", "freefall");

  b.hull("propeller", "prop:0");
  b.hull("propeller", "prop:2");
  b.hull("rudder", "rudder");
  return b.build();
}

export const CARGO_TEMPLATES: readonly ShipTemplate[] = [
  {
    id: "ever-given",
    kind: "cargo",
    name: "Ever Given",
    year: 2018,
    blurb: "Got stuck in the Suez Canal in 2021",
    build: buildEverGiven,
  },
  {
    id: "little-hopper",
    kind: "cargo",
    name: "Little Hopper",
    year: 2005,
    blurb: "A small ship with cranes that hops between little ports",
    build: buildFeeder,
  },
];
