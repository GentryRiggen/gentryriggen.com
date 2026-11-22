import type { Compartment, ShipSpec } from "../../ships/types";

/**
 * Box-hull test ships for the sim's 1.1 features (wing cells, portholes,
 * timed openings, the floor). A box L × B × D, origin on the keel at
 * midships; the displacement matches the box at its draught.
 */

export interface BoxShip {
  length: number;
  beam: number;
  depth: number;
  draught: number;
  kg: number;
  seaDepthM?: number;
  tcg?: number;
  compartments: Compartment[];
  extra?: Partial<ShipSpec>;
}

export function compartment(
  id: string,
  fromX: number,
  toX: number,
  top: number,
  more: Partial<Compartment> = {}
): Compartment {
  return {
    id,
    label: id,
    kind: "hold",
    fromX,
    toX,
    aftBulkheadTopZ: top,
    fwdBulkheadTopZ: top,
    permeability: 0.95,
    ...more,
  };
}

export function boxShip(p: BoxShip): ShipSpec {
  const stations = Array.from({ length: 41 }, (_, i) => ({
    x: -p.length / 2 + (p.length * i) / 40,
    offsets: [
      [0, p.beam / 2],
      [p.depth, p.beam / 2],
    ] as const,
  }));
  return {
    id: "titanic",
    name: "Box",
    year: 2026,
    lbp: p.length,
    loa: p.length,
    beam: p.beam,
    depth: p.depth,
    draught: p.draught,
    displacementT: (p.length * p.beam * p.draught * 1025) / 1000,
    kg: p.kg,
    lcg: 0,
    tcg: p.tcg ?? 0,
    stations,
    sheerZ: () => p.depth,
    superstructure: [],
    compartments: p.compartments,
    realNight: [],
    girder: { hogMaxNm: 1e15, sagMaxNm: 1e15 },
    scripted: [],
    funnels: [],
    decks: [],
    seaDepthM: p.seaDepthM ?? 3000,
    clockStartS: 0,
    cause: "torpedo",
    ...p.extra,
  };
}

/** Wing bunkers this far out from the centreline (m) in the 100 m ship. */
export const WING_Y = 6;

/**
 * 100 m × 20 m × 12 m, draught 5 m: an aft hold, then a centre space with
 * a port and a starboard wing bunker beside it (x -15…15), then a fore hold.
 */
export function wingShip(more: Partial<BoxShip> = {}): ShipSpec {
  const top = 12;
  return boxShip({
    length: 100,
    beam: 20,
    depth: top,
    draught: 5,
    kg: 7,
    compartments: [
      compartment("aft", -50, -15, top),
      compartment("centre", -15, 15, top, {
        span: { side: "centre", y: WING_Y },
      }),
      compartment("port", -15, 15, top, { span: { side: "port", y: WING_Y } }),
      compartment("stbd", -15, 15, top, {
        span: { side: "starboard", y: WING_Y },
      }),
      compartment("fore", 15, 50, top),
    ],
    ...more,
  });
}

/**
 * 200 m × 24 m × 14 m, draught 6 m, ten equal holds whose bulkheads stop
 * at 9 m (a lower deck), so flooding at the bow spills aft hold by hold.
 */
export function longShip(more: Partial<BoxShip> = {}): ShipSpec {
  return boxShip({
    length: 200,
    beam: 24,
    depth: 14,
    draught: 6,
    kg: 8,
    compartments: Array.from({ length: 10 }, (_, i) =>
      compartment(`h${i}`, -100 + 20 * i, -80 + 20 * i, 9)
    ),
    ...more,
  });
}
