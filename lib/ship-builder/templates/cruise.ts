import type { Ship } from "../model/types";
import { ShipBuilder, range } from "./modernBuilder";
import { wallRun } from "./bulkheads";
import type { ShipTemplate } from "./types";

/** Wonder of the Seas: a tall, wide megaship with pools and a waterslide. */
function buildWonderOfTheSeas(): Ship {
  const b = new ShipBuilder("cruise", "Wonder of the Seas", 20, 7);
  const inner = range(1, 6);
  const sides = [0, 6];
  const innerPool = [2, 3];
  const outerInner = [1, 4, 5];

  // Main deck: crew quarters forward, plain decks everywhere else.
  b.cells("cabin-crew", 0, 4, 14, sides);
  b.decks(0, 0, 4, sides);
  b.decks(0, 14, 60, sides);
  b.decks(0, 0, 60, inner);

  // Level 1: the long promenade deck, with a pool at each end.
  b.decks(1, 6, 54, outerInner);
  b.decks(1, 8, 50, innerPool);
  b.decks(1, 52, 54, innerPool);
  b.grid("pool", 1, 6, 2);
  b.grid("pool", 1, 50, 2);
  b.decks(1, 6, 18, sides);
  b.cells("cabin-balcony", 1, 18, 42, sides);
  b.decks(1, 42, 54, sides);

  // Level 2: balcony cabins, with the bridge across the front.
  b.grid("bridge-7", 2, 9, 0);
  b.decks(2, 10, 50, inner);
  b.decks(2, 10, 20, sides);
  b.cells("cabin-balcony", 2, 20, 40, sides);
  b.decks(2, 40, 50, sides);

  // Level 3: the sun deck with two pools and a slide.
  b.decks(3, 20, 40, outerInner);
  b.decks(3, 20, 22, innerPool);
  b.grid("pool", 3, 22, 2);
  b.decks(3, 24, 30, innerPool);
  b.grid("pool", 3, 30, 2);
  b.decks(3, 32, 40, innerPool);
  b.decks(3, 20, 40, sides);

  b.onTop("funnel-modern", 2, 44, 2);
  b.onTop("funnel-modern", 2, 44, 4);
  b.onTop("waterslide", 3, 26, 2);
  b.onTop("climbing-wall", 3, 36, 4);

  for (const z of sides) {
    for (const x of [6, 7, 8, 50, 51, 52, 53]) {
      b.boat("lifeboat-enclosed", 1, x, z);
    }
    for (const x of [10, 11, 12, 13, 46, 47, 48, 49]) {
      b.boat("lifeboat-enclosed", 2, x, z);
    }
    for (const x of [14, 15, 16, 17, 18, 19, 40, 41, 42, 43, 44, 45]) {
      b.raft(2, x, z);
    }
  }

  b.hull("azipod", "prop:1");
  b.hull("azipod", "prop:2");
  b.withBulkheads(wallRun(1, 19, "deck"));
  return b.build();
}

/** Ocean Breeze: a friendly mid-sized cruise ship from the nineties. */
function buildOceanBreeze(): Ship {
  const b = new ShipBuilder("cruise", "Ocean Breeze", 12, 5);
  const inner = [1, 2, 3];
  const sides = [0, 4];

  b.decks(0, 0, 36, inner);
  b.decks(0, 0, 4, sides);
  b.cells("cabin-crew", 0, 4, 10, sides);
  b.decks(0, 10, 36, sides);

  b.decks(1, 8, 30, inner);
  b.decks(1, 8, 14, sides);
  b.cells("cabin-2nd", 1, 14, 24, sides);
  b.decks(1, 24, 30, sides);

  b.grid("bridge-5", 2, 11, 0);
  b.decks(2, 12, 26, [3]);
  b.decks(2, 12, 14, [1, 2]);
  b.decks(2, 16, 26, [1, 2]);
  b.grid("pool", 2, 14, 1);

  b.onTop("funnel-modern", 2, 22, 2);

  for (const z of sides) {
    for (const x of [8, 9, 10, 28, 29]) {
      b.boat("lifeboat-enclosed", 1, x, z);
    }
    for (const x of range(0, 5)) b.raft(0, x, z);
  }

  b.hull("propeller", "prop:1");
  b.hull("propeller", "prop:2");
  b.hull("rudder", "rudder");
  b.withBulkheads(wallRun(1, 11, "deck"));
  return b.build();
}

export const CRUISE_TEMPLATES: readonly ShipTemplate[] = [
  {
    id: "wonder-of-the-seas",
    kind: "cruise",
    name: "Wonder of the Seas",
    year: 2022,
    blurb: "One of the biggest ships ever, with a waterslide on top",
    build: buildWonderOfTheSeas,
  },
  {
    id: "ocean-breeze",
    kind: "cruise",
    name: "Ocean Breeze",
    year: 1990,
    blurb: "A friendly cruise ship with a pool and plenty of sun decks",
    build: buildOceanBreeze,
  },
];
