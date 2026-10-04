import type { Ship } from "../model/types";
import { ShipBuilder, range } from "./modernBuilder";
import type { ShipTemplate } from "./types";

const ALL_ROWS = range(0, 4);
const SIDES = [0, 3];

/** Arleigh Burke destroyer: a long grey hull, twin stacks and a helipad. */
function buildDestroyer(): Ship {
  const b = new ShipBuilder("navy", "Arleigh Burke destroyer", 14, 4);

  b.decks(0, 0, 42, ALL_ROWS);

  // The deckhouse amidships: crew quarters forward, deck blocks for the stacks.
  b.cells("cabin-crew", 1, 14, 22, [1, 2]);
  b.decks(1, 14, 28, SIDES);
  b.decks(1, 22, 28, [1, 2]);
  b.grid("bridge", 2, 16, 0);

  b.onSquare("turret-large", 0, 4, 1);
  b.onTop("turret-small", 0, 10, 2);
  b.onMast("radar-mast", 1, 22, 1);
  b.onTop("funnel-modern", 1, 24, 2);
  b.onTop("funnel-modern", 1, 26, 2);

  const pad = b.onSquare("helipad", 0, 34, 1);
  b.attach("helicopter", pad, "heli");

  for (const z of SIDES) {
    for (const x of [24, 26]) b.boat("rib-boat", 1, x, z);
    for (const x of [...range(8, 14), ...range(28, 38)]) b.raft(0, x, z);
  }

  b.hull("propeller", "prop:0");
  b.hull("propeller", "prop:2");
  b.hull("rudder", "rudder");
  return b.build();
}

/** Coast Guard cutter: a small white rescue ship with a red stripe. */
function buildCutter(): Ship {
  const b = new ShipBuilder("navy", "Coast Guard cutter", 8, 4);
  b.withPaint({ topsides: "white", bottom: "red" });

  b.decks(0, 0, 24, ALL_ROWS);

  b.cells("cabin-crew", 1, 6, 10, [1, 2]);
  b.decks(1, 6, 10, SIDES);
  b.decks(1, 10, 14, ALL_ROWS);
  b.grid("bridge", 2, 8, 0);

  b.onTop("turret-small", 0, 4, 2);
  b.onMast("radar-mast", 1, 10, 1);
  b.onTop("funnel-modern", 1, 12, 2);

  const pad = b.onSquare("helipad", 0, 16, 1);
  b.attach("helicopter", pad, "heli");

  for (const z of SIDES) {
    for (const x of [10, 12]) b.boat("rib-boat", 1, x, z);
    for (const x of range(14, 23)) b.raft(0, x, z);
  }

  b.hull("propeller", "prop:0");
  b.hull("propeller", "prop:2");
  b.hull("rudder", "rudder");
  return b.build();
}

export const NAVY_TEMPLATES: readonly ShipTemplate[] = [
  {
    id: "arleigh-burke",
    kind: "navy",
    name: "Arleigh Burke destroyer",
    year: 1991,
    blurb: "A fast grey warship with a big gun and a helicopter",
    build: buildDestroyer,
  },
  {
    id: "coast-guard-cutter",
    kind: "navy",
    name: "Coast Guard cutter",
    year: 1990,
    blurb: "A white rescue ship that helps boats in trouble",
    build: buildCutter,
  },
];
