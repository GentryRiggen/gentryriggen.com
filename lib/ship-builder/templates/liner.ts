import { propCount } from "../model/attach";
import { KIND_DEFAULTS } from "../model/kinds";
import type { PaintColor } from "../model/paint";
import {
  HULL_ID,
  type PartType,
  type PlacedPart,
  type Bulkhead,
  type Ship,
} from "../model/types";
import { wallRun, wallsWithLowBow } from "./bulkheads";
import type { ShipTemplate } from "./types";

/*
 * Block-built approximations of famous liners. The big four are stacked from
 * three layers, bottom to top:
 *
 *   level 0  the hull deck: forecastle, the long main block, a poop deck
 *   level 1  the boat deck, with davits and lifeboats along both edges
 *   level 2  a narrower deck carrying the bridge, the funnels and the dome
 *
 * Blocks are added first, then everything that hangs on them, so validateShip
 * can replay the list in order.
 */

interface Builder {
  parts: PlacedPart[];
  /** "level:x:z" -> id of the block there. */
  blocks: Map<string, string>;
  /** "level:x:z" -> cabin type to build instead of a plain deck block. */
  overrides: Map<string, PartType>;
  count: number;
}

interface Range {
  from: number;
  to: number;
}

interface Boat {
  x: number;
  type: PartType;
  /** Hangs between this davit and the next one along the edge. */
  paired?: boolean;
}

function newBuilder(): Builder {
  return { parts: [], blocks: new Map(), overrides: new Map(), count: 0 };
}

const cellKey = (level: number, x: number, z: number) => `${level}:${x}:${z}`;

function nextId(b: Builder): string {
  b.count += 1;
  return `p${b.count}`;
}

function addGrid(
  b: Builder,
  type: PartType,
  level: number,
  x: number,
  z: number
): string {
  const id = nextId(b);
  b.parts.push({
    id,
    type,
    anchor: { kind: "grid", level, x, z },
    rotation: 0,
  });
  b.blocks.set(cellKey(level, x, z), id);
  return id;
}

/** The id of the block at a cell; throws on a mistake in a template. */
function blockAt(b: Builder, level: number, x: number, z: number): string {
  const id = b.blocks.get(cellKey(level, x, z));
  if (!id) throw new Error(`No block at ${level}:${x}:${z}`);
  return id;
}

/** Marks cells to be built as cabins instead of plain deck blocks. */
function planCabins(
  b: Builder,
  type: PartType,
  level: number,
  xs: Range,
  zs: Range
): void {
  for (let x = xs.from; x <= xs.to; x++) {
    for (let z = zs.from; z <= zs.to; z++) {
      b.overrides.set(cellKey(level, x, z), type);
    }
  }
}

/** Fills a rectangle with deck blocks, or the cabins planned for a cell. */
function fillDeck(b: Builder, level: number, xs: Range, zs: Range): void {
  for (let x = xs.from; x <= xs.to; x++) {
    for (let z = zs.from; z <= zs.to; z++) {
      const type = b.overrides.get(cellKey(level, x, z)) ?? "deck-1x1";
      addGrid(b, type, level, x, z);
    }
  }
}

function mount(
  b: Builder,
  type: PartType,
  parentId: string,
  pointId: string,
  color?: PaintColor
): string {
  const id = nextId(b);
  b.parts.push({
    id,
    type,
    anchor: { kind: "attach", parentId, pointId },
    rotation: 0,
    ...(color ? { color } : {}),
  });
  return id;
}

function bridgeFor(beam: number): PartType {
  if (beam === 3) return "bridge-3";
  return beam === 4 ? "bridge" : "bridge-5";
}

/** One bridge spanning the whole beam, across the cells at one x. */
function addBridge(b: Builder, beam: number, level: number, x: number): string {
  const id = nextId(b);
  b.parts.push({
    id,
    type: bridgeFor(beam),
    anchor: { kind: "grid", level, x, z: 0 },
    rotation: 0,
  });
  return id;
}

/** Propellers under the stern, a rudder, and a flag on the stern. */
function addStern(b: Builder, beam: number): void {
  for (let i = 0; i < propCount(beam); i++) {
    mount(b, "propeller", HULL_ID, `prop:${i}`);
  }
  mount(b, "rudder", HULL_ID, "rudder");
  mount(b, "stern-flag", HULL_ID, "flag");
}

/** A davit on both edge cells at each boat's x, then a boat on each. */
function addBoats(
  b: Builder,
  beam: number,
  level: number,
  boats: readonly Boat[]
): void {
  const edges = [0, beam - 1];
  const davits = new Map<string, string>();
  for (const { x, paired } of boats) {
    for (const dx of paired ? [0, 1] : [0]) {
      for (const z of edges) {
        const parent = blockAt(b, level, x + dx, z);
        davits.set(
          cellKey(level, x + dx, z),
          mount(b, "davit", parent, `davit:${x + dx}:${z}`)
        );
      }
    }
  }
  // A paired boat needs the davit beside its own, so every davit goes first.
  for (const { x, type, paired } of boats) {
    for (const z of edges) {
      const davit = davits.get(cellKey(level, x, z))!;
      mount(b, type, davit, paired ? "big-boat" : "boat");
    }
  }
}

function range(from: number, to: number, step = 1): number[] {
  const values: number[] = [];
  for (let x = from; x <= to; x += step) values.push(x);
  return values;
}

/** One boat per x, cycling through the given types. */
function boatsAt(xs: number[], types: PartType[], paired = false): Boat[] {
  return xs.map((x, i) => ({ x, type: types[i % types.length], paired }));
}

const STANDARD = "lifeboat-standard";
const COLLAPSIBLE = "lifeboat-collapsible";

interface GrandLinerSpec {
  id: string;
  name: string;
  year: number;
  blurb: string;
  lengthSegments: number;
  beam: number;
  paint: { topsides: PaintColor; bottom: PaintColor };
  funnelColor?: PaintColor;
  /** Last x of the forecastle, which starts at the bow. */
  forecastle: number;
  /** The long level-0 block; a poop deck follows it. */
  main: Range;
  /** Level 1, the boat deck, which the davits stand on. */
  upper: Range;
  /** Level 2, narrower, under the funnels. */
  topDeck: Range;
  bridgeX: number;
  funnelXs: readonly number[];
  domeX?: number;
  /** Crew quarters fill the first and last columns of the main block. */
  crewColumns: { fore: number; aft: number };
  firstClass: Range;
  secondClass: Range;
  /** The column of third-class berths, in the main block. */
  thirdClassX: number;
  boats: readonly Boat[];
  /** Watertight walls below deck. */
  bulkheads: readonly Bulkhead[];
}

function buildGrandLiner(spec: GrandLinerSpec): Ship {
  const { beam, main } = spec;
  const lastZ = beam - 1;
  const allZ: Range = { from: 0, to: lastZ };
  const innerZ: Range = { from: 1, to: lastZ - 1 };
  const funnelZ = innerZ.from;
  const centre = Math.floor(lastZ / 2);
  const poop: Range = { from: main.to + 1, to: main.to + 6 };
  const b = newBuilder();

  const foreCrew = {
    from: main.from,
    to: main.from + spec.crewColumns.fore - 1,
  };
  const aftCrew = { from: main.to - spec.crewColumns.aft + 1, to: main.to };
  planCabins(b, "cabin-crew", 0, foreCrew, allZ);
  planCabins(b, "cabin-crew", 0, aftCrew, allZ);
  const third = { from: spec.thirdClassX, to: spec.thirdClassX };
  planCabins(b, "cabin-3rd", 0, third, innerZ);
  planCabins(b, "cabin-1st", 1, spec.firstClass, innerZ);
  planCabins(b, "cabin-2nd", 1, spec.secondClass, innerZ);

  fillDeck(b, 0, { from: 0, to: spec.forecastle }, allZ);
  fillDeck(b, 0, main, allZ);
  fillDeck(b, 0, poop, allZ);
  fillDeck(b, 1, spec.upper, allZ);
  fillDeck(b, 2, spec.topDeck, innerZ);
  const bridge = addBridge(b, beam, 2, spec.bridgeX);

  mount(b, "searchlight", bridge, "light");
  for (const x of spec.funnelXs) {
    mount(
      b,
      "funnel-large",
      blockAt(b, 2, x, funnelZ),
      `funnel-lg:${x}:${funnelZ}`,
      spec.funnelColor
    );
  }
  if (spec.domeX !== undefined) {
    mount(b, "dome", blockAt(b, 2, spec.domeX, funnelZ), "funnel");
  }
  addBoats(b, beam, 1, spec.boats);

  const foremast = mount(
    b,
    "mast",
    blockAt(b, 0, spec.forecastle - 1, centre),
    "mast"
  );
  mount(b, "mast", blockAt(b, 0, poop.from + 1, centre), "mast");
  mount(b, "crows-nest", foremast, "nest");
  mount(b, "wireless-aerial", foremast, "aerial");
  addStern(b, beam);

  // Ventilators on the open well deck between the forecastle and main block.
  for (const z of [innerZ.from, innerZ.to]) {
    b.parts.push({
      id: nextId(b),
      type: "ventilator",
      anchor: { kind: "grid", level: 0, x: spec.forecastle + 2, z },
      rotation: 0,
    });
  }

  return {
    v: 7,
    kind: "liner",
    name: spec.name,
    hull: {
      lengthSegments: spec.lengthSegments,
      beam,
      bow: KIND_DEFAULTS.liner.bow,
      stern: KIND_DEFAULTS.liner.stern,
      paint: { ...spec.paint },
      bulkheads: spec.bulkheads.map((wall) => ({ ...wall })),
    },
    parts: b.parts,
  };
}

const TITANIC: GrandLinerSpec = {
  id: "titanic",
  name: "RMS Titanic",
  year: 1912,
  blurb: "The famous liner that hit an iceberg in 1912.",
  lengthSegments: 20,
  beam: 4,
  paint: { topsides: "black", bottom: "red" },
  forecastle: 5,
  main: { from: 10, to: 49 },
  upper: { from: 14, to: 45 },
  topDeck: { from: 18, to: 40 },
  bridgeX: 16,
  funnelXs: [22, 27, 32, 37],
  domeX: 19,
  crewColumns: { fore: 4, aft: 3 },
  firstClass: { from: 20, to: 22 },
  secondClass: { from: 33, to: 34 },
  thirdClassX: 14,
  // 14 standard boats and 4 collapsibles: nowhere near enough for everyone.
  boats: [
    ...boatsAt(range(20, 32, 2), [STANDARD]),
    ...boatsAt(range(34, 36, 2), [COLLAPSIBLE]),
  ],
  // 15 walls make 16 compartments, but the forward ones only reach the
  // waterline, so water that fills them spills over into the next.
  bulkheads: wallsWithLowBow(15, 9),
};

const OLYMPIC: GrandLinerSpec = {
  ...TITANIC,
  id: "olympic",
  name: "RMS Olympic",
  year: 1911,
  blurb: "Titanic's big sister, who sailed for 24 years.",
  // An open forward promenade and fewer first-class cabins.
  upper: { from: 16, to: 45 },
  firstClass: { from: 20, to: 21 },
};

const BRITANNIC: GrandLinerSpec = {
  ...TITANIC,
  id: "britannic",
  name: "HMHS Britannic",
  year: 1915,
  blurb: "A giant hospital ship with lifeboats for everyone.",
  beam: 5,
  paint: { topsides: "white", bottom: "red" },
  // Her gantry davits each swung out a big lifeboat.
  boats: [
    ...boatsAt(range(18, 32, 2), ["lifeboat-large"], true),
    ...boatsAt(range(36, 40, 2), [STANDARD]),
  ],
  // Rebuilt with her walls raised all the way to the deck.
  bulkheads: wallRun(1, 15, "deck"),
};

const LUSITANIA: GrandLinerSpec = {
  ...TITANIC,
  id: "lusitania",
  name: "RMS Lusitania",
  year: 1907,
  blurb: "A super-fast liner and queen of the Atlantic.",
  lengthSegments: 18,
  beam: 5,
  funnelColor: "red",
  bulkheads: wallRun(1, 13, "deck"),
  main: { from: 9, to: 44 },
  upper: { from: 12, to: 40 },
  topDeck: { from: 15, to: 37 },
  bridgeX: 13,
  funnelXs: [17, 22, 27, 32],
  domeX: undefined,
  crewColumns: { fore: 3, aft: 3 },
  firstClass: { from: 19, to: 20 },
  secondClass: { from: 29, to: 30 },
  thirdClassX: 12,
  boats: boatsAt(range(15, 36), [STANDARD, COLLAPSIBLE]),
};

function buildCarpathia(): Ship {
  const beam = 3;
  const allZ: Range = { from: 0, to: 2 };
  const middle: Range = { from: 1, to: 1 };
  const b = newBuilder();

  planCabins(b, "cabin-crew", 0, { from: 5, to: 9 }, allZ);
  planCabins(b, "cabin-3rd", 0, { from: 10, to: 11 }, middle);
  planCabins(b, "cabin-1st", 1, { from: 18, to: 20 }, middle);
  planCabins(b, "cabin-2nd", 1, { from: 22, to: 23 }, middle);

  fillDeck(b, 0, { from: 0, to: 3 }, allZ);
  fillDeck(b, 0, { from: 5, to: 29 }, allZ);
  fillDeck(b, 0, { from: 31, to: 34 }, allZ);
  fillDeck(b, 1, { from: 13, to: 27 }, allZ);
  const bridge = addBridge(b, beam, 1, 12);

  mount(b, "searchlight", bridge, "light");
  mount(b, "funnel", blockAt(b, 1, 16, 1), "funnel", "red");
  addBoats(b, beam, 1, boatsAt(range(15, 27, 2), [STANDARD]));

  // Four masts: one at each end of the hull and one on each end deck.
  mount(b, "mast", HULL_ID, "mast-fore");
  mount(b, "mast", blockAt(b, 0, 2, 1), "mast");
  mount(b, "mast", blockAt(b, 0, 32, 1), "mast");
  mount(b, "mast", HULL_ID, "mast-aft");
  addStern(b, beam);

  return {
    v: 7,
    kind: "liner",
    name: "RMS Carpathia",
    hull: {
      lengthSegments: 12,
      beam,
      bow: KIND_DEFAULTS.liner.bow,
      stern: KIND_DEFAULTS.liner.stern,
      paint: { topsides: "black", bottom: "red" },
      bulkheads: wallRun(1, 11, "deck"),
    },
    parts: b.parts,
  };
}

function grandLinerTemplate(spec: GrandLinerSpec): ShipTemplate {
  return {
    id: spec.id,
    kind: "liner",
    name: spec.name,
    year: spec.year,
    blurb: spec.blurb,
    build: () => buildGrandLiner(spec),
  };
}

export const LINER_TEMPLATES: readonly ShipTemplate[] = [
  grandLinerTemplate(TITANIC),
  grandLinerTemplate(OLYMPIC),
  grandLinerTemplate(BRITANNIC),
  {
    id: "carpathia",
    kind: "liner",
    name: "RMS Carpathia",
    year: 1903,
    blurb: "The brave little ship that rescued Titanic's survivors.",
    build: buildCarpathia,
  },
  grandLinerTemplate(LUSITANIA),
];
