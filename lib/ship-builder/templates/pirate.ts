import type { Bulkhead, PartType, Ship } from "../model/types";
import { wallsWithLowBow } from "./bulkheads";
import { ShipBuilder, range } from "./modernBuilder";
import type { ShipTemplate } from "./types";

type HullPaint = Parameters<ShipBuilder["withPaint"]>[0];

interface Layout {
  name: string;
  segments: number;
  beam: number;
  paint?: HullPaint;
  /** The helm's x on the raised quarterdeck (level 1). */
  helmX: number;
  /** Cabin cells at level 1 over the aft deck: [x, z] pairs. */
  cabins: ReadonlyArray<readonly [number, number]>;
  /** Decor on the interior of the deck (level 1): [type, x, z]. */
  decor: ReadonlyArray<readonly [PartType, number, number]>;
  /** Davit x positions, one boat each, on both sides. */
  boatXs: readonly number[];
  /** Cannons line both edges over this run of x (davits are skipped). */
  cannonXs: readonly number[];
  /** Bulkheads from the bow up to this boundary only reach the waterline. */
  lowBowUntil: number;
}

/**
 * Walls on every boundary, but the bow half's only reach the waterline, so a
 * strike near the bow spills water from one compartment into the next and sinks
 * her, while a strike amidships (the walls there reach the deck) is held.
 */
function lowBowWalls(segments: number, lowUntil: number): Bulkhead[] {
  return wallsWithLowBow(segments - 1, lowUntil);
}

/**
 * Everything but the rig: decks, quarterdeck, helm, decor, cannons, boats, bow
 * and stern. Masts and sails vary per ship, so the caller adds them last.
 */
function buildHull(layout: Layout): ShipBuilder {
  const { segments, beam } = layout;
  const length = segments * 3;
  const sides = [0, beam - 1];
  const b = new ShipBuilder("pirate", layout.name, segments, beam);
  if (layout.paint) b.withPaint(layout.paint);

  b.decks(0, 0, length, range(0, beam));
  for (const [x, z] of layout.cabins) b.grid("cabin-captain", 1, x, z);
  b.grid("helm-wheel", 1, layout.helmX, 1);
  for (const [type, x, z] of layout.decor) b.grid(type, 1, x, z);

  for (const z of sides) {
    for (const x of layout.cannonXs) {
      if (!layout.boatXs.includes(x)) b.cannon(0, x, z);
    }
    for (const x of layout.boatXs) b.boat("rowboat", 0, x, z);
  }

  b.withBulkheads(lowBowWalls(segments, layout.lowBowUntil));
  b.hull("sail-jib", "jib");
  b.hull("rudder", "rudder");
  return b;
}

/** A mast set in the deck's centre row at x, with the sails listed by slot. */
function deckMast(
  b: ShipBuilder,
  mast: PartType,
  x: number,
  beam: number,
  sails: readonly PartType[]
): string {
  const id = b.onMast(mast, 0, x, Math.floor(beam / 2));
  sails.forEach((sail, slot) => b.sail(sail, id, slot));
  return id;
}

/** A small, fast sloop: one tall mast and a bow mast. */
function buildSloop(): Ship {
  const b = buildHull({
    name: "Small sloop",
    segments: 6,
    beam: 3,
    helmX: 13,
    cabins: [
      [16, 1],
      [17, 1],
    ],
    decor: [
      ["ship-anchor", 0, 1],
      ["barrel-stack", 1, 1],
      ["treasure-chest", 15, 1],
      ["pirate-crew", 12, 2],
    ],
    boatXs: [9, 11],
    cannonXs: [3, 4],
    lowBowUntil: 1,
  });
  const main = deckMast(b, "mast-wood-tall", 7, 3, [
    "sail-square-large",
    "sail-square",
  ]);
  b.attach("flag-jolly-roger", main, "masthead");
  const fore = b.hull("mast-wood-short", "mast-fore");
  b.sail("sail-square-small", fore, 0);
  return b.build();
}

/** The Whydah Gally: a real slave ship turned pirate, sunk with her gold. */
function buildWhydah(): Ship {
  const b = buildHull({
    name: "Whydah Gally",
    segments: 10,
    beam: 4,
    helmX: 25,
    cabins: [
      [28, 1],
      [28, 2],
      [29, 1],
      [29, 2],
    ],
    decor: [
      ["ship-anchor", 1, 1],
      ["barrel-stack", 6, 2],
      ["crate-stack", 4, 1],
      ["treasure-chest", 19, 1],
      ["pirate-crew", 24, 2],
    ],
    boatXs: [14, 16, 18],
    cannonXs: range(3, 24),
    lowBowUntil: 4,
  });
  const main = deckMast(b, "mast-wood-main", 11, 4, [
    "sail-square-large",
    "sail-square",
    "sail-square-small",
  ]);
  b.attach("flag-jolly-roger", main, "masthead");
  const fore = b.hull("mast-wood-tall", "mast-fore");
  b.sail("sail-square", fore, 0);
  b.sail("sail-square-small", fore, 1);
  deckMast(b, "mast-wood-short", 22, 4, ["sail-lateen"]);
  return b.build();
}

/** Queen Anne's Revenge: Blackbeard's flagship, dark wood and many guns. */
function buildQueenAnnesRevenge(): Ship {
  const b = buildHull({
    name: "Queen Anne's Revenge",
    segments: 12,
    beam: 5,
    paint: { topsides: "dark-oak", bottom: "black" },
    helmX: 30,
    cabins: [
      [35, 1],
      [35, 2],
      [35, 3],
    ],
    decor: [
      ["ship-anchor", 1, 1],
      ["ship-anchor", 1, 3],
      ["barrel-stack", 4, 1],
      ["barrel-stack", 4, 3],
      ["crate-stack", 22, 1],
      ["treasure-chest", 22, 3],
      ["pirate-crew", 30, 3],
      ["parrot", 28, 2],
    ],
    boatXs: [17, 19, 21],
    cannonXs: range(3, 26),
    lowBowUntil: 4,
  });
  const main = deckMast(b, "mast-wood-main", 13, 5, [
    "sail-square-large",
    "sail-square",
    "sail-square-small",
  ]);
  b.attach("flag-jolly-roger", main, "masthead");
  const fore = b.hull("mast-wood-tall", "mast-fore");
  b.sail("sail-square", fore, 0);
  b.sail("sail-square-small", fore, 1);
  deckMast(b, "mast-wood-short", 26, 5, ["sail-lateen"]);
  b.hull("figurehead", "figurehead");
  b.attach("plank", b.blockAt(0, 33, 0), "edge:33:0");
  return b.build();
}

/** A made-up ghost galleon with black sails. */
function buildGalleon(): Ship {
  const b = buildHull({
    name: "Black Pearl galleon",
    segments: 14,
    beam: 5,
    paint: { topsides: "black", bottom: "dark-oak" },
    helmX: 35,
    cabins: [
      [40, 1],
      [40, 2],
      [40, 3],
      [39, 2],
    ],
    decor: [
      ["ship-anchor", 1, 1],
      ["ship-anchor", 1, 3],
      ["barrel-stack", 4, 1],
      ["crate-stack", 4, 3],
      ["treasure-chest", 26, 2],
      ["pirate-crew", 35, 3],
      ["parrot", 32, 2],
    ],
    boatXs: [20, 22, 24],
    cannonXs: range(3, 27),
    lowBowUntil: 5,
  });
  const main = deckMast(b, "mast-wood-main", 15, 5, [
    "sail-square-large",
    "sail-square",
    "sail-square-small",
  ]);
  b.attach("flag-jolly-roger", main, "masthead");
  const fore = b.hull("mast-wood-tall", "mast-fore");
  b.sail("sail-square", fore, 0);
  b.sail("sail-square-small", fore, 1);
  deckMast(b, "mast-wood-short", 30, 5, ["sail-lateen"]);
  b.hull("figurehead", "figurehead");
  return blackSails(b.build());
}

/** The galleon's canvas is black; the lateen and jib stay as they are. */
function blackSails(ship: Ship): Ship {
  return {
    ...ship,
    parts: ship.parts.map((part) =>
      part.type.startsWith("sail-square") ? { ...part, color: "black" } : part
    ),
  };
}

export const PIRATE_TEMPLATES: readonly ShipTemplate[] = [
  {
    id: "small-sloop",
    kind: "pirate",
    name: "Small sloop",
    year: 1700,
    blurb: "A small fast ship for your first pirate crew",
    build: buildSloop,
  },
  {
    id: "whydah-gally",
    kind: "pirate",
    name: "Whydah Gally",
    year: 1717,
    blurb: "A real pirate ship that sank with its treasure",
    build: buildWhydah,
  },
  {
    id: "queen-annes-revenge",
    kind: "pirate",
    name: "Queen Anne's Revenge",
    year: 1718,
    blurb: "Blackbeard's flagship, with forty cannons",
    build: buildQueenAnnesRevenge,
  },
  {
    id: "black-pearl-galleon",
    kind: "pirate",
    name: "Black Pearl galleon",
    year: 1720,
    blurb: "A made-up ghostly ship with black sails",
    build: buildGalleon,
  },
];
