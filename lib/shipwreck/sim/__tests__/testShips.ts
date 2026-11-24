import type { Compartment, Opening, ShipSpec } from "../../ships/types";
import { type Body, stepFloat } from "../body";
import { SIM_STEP_S } from "../constants";
import { createSimRunner } from "../run";
import { stormComponents } from "../waves";

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

/** The side tanks' inboard bulkheads in the storm ship (m from the centreline). */
export const TANK_Y = 9;

/**
 * 200 m × 24 m × 12 m, draught 8.5 m in fresh water (a laker's 3.5 m of
 * freeboard): an after space, one long hold with a side tank each side of
 * it (x -80…80), a fore space; three hatches on the hold (No. 1 forward)
 * with 0.6 m coamings, and a vent on deck into each side tank. No storm
 * unless `extra` gives one.
 */
export function stormShip(more: Partial<BoxShip> = {}): ShipSpec {
  const top = 12;
  const draught = more.draught ?? 8.5;
  const base = boxShip({
    length: 200,
    beam: 24,
    depth: top,
    draught,
    kg: 8,
    compartments: [
      compartment("aft", -100, -80, top),
      compartment("hold", -80, 80, top, {
        span: { side: "centre", y: TANK_Y },
      }),
      compartment("tank-p", -80, 80, top, {
        span: { side: "port", y: TANK_Y },
      }),
      compartment("tank-s", -80, 80, top, {
        span: { side: "starboard", y: TANK_Y },
      }),
      compartment("fore", 80, 100, top),
    ],
    ...more,
    extra: {
      waterDensity: 1000,
      deckOpenings: [
        {
          id: "h1",
          compartmentId: "hold",
          kind: "hatch",
          x: 50,
          y: 0,
          z: 12.6,
          areaM2: 0.02,
        },
        {
          id: "h2",
          compartmentId: "hold",
          kind: "hatch",
          x: 0,
          y: 0,
          z: 12.6,
          areaM2: 0.02,
        },
        {
          id: "h3",
          compartmentId: "hold",
          kind: "hatch",
          x: -50,
          y: 0,
          z: 12.6,
          areaM2: 0.02,
        },
      ],
      ...more.extra,
    },
  });
  // In fresh water: the displacement of the box at her draught.
  return { ...base, displacementT: (200 * 24 * draught * 1000) / 1000 };
}

/** The torpedo ship's bulkheads, aft to forward (m). */
export const TORPEDO_BULKHEADS = [
  -75, -58, -41, -24, -8, 8, 24, 41, 58, 75,
] as const;

/**
 * 150 m × 20 m × 14 m, draught 6 m: nine full-breadth holds `c0` (aft) to
 * `c8`, struck on the port side, forward first, 8 s apart. A hit at `c5`
 * strikes 1 m forward of its after bulkhead (its 8 m hole spans the
 * bulkhead, 5 m in `c5` and 3 m in `c4`); a last torpedo hits `c1` at
 * t = 600. Her real run: `c5`, `c6` and the finisher.
 */
export function torpedoShip(more: Partial<BoxShip> = {}): ShipSpec {
  const b = TORPEDO_BULKHEADS;
  return boxShip({
    length: 150,
    beam: 20,
    depth: 14,
    draught: 6,
    kg: 7,
    compartments: Array.from({ length: 9 }, (_, i) =>
      compartment(`c${i}`, b[i], b[i + 1], 12)
    ),
    ...more,
    extra: {
      torpedo: {
        side: "port",
        order: "fwd-first",
        staggerS: 8,
        hole: { areaM2: 6, zLow: 3, zHigh: 7, lengthM: 8 },
        hitX: { c5: b[5] + 1 },
        finisher: { spotId: "c1", t: 600 },
        realSpots: ["c5", "c6", "finisher"],
      },
      ...more.extra,
    },
  });
}

/**
 * The torpedo ship with `c4` (amidships) a centre space between a port and
 * a starboard wing bunker (`WING_Y` out): a full-breadth hold floods level
 * (no list), a wing on the struck side does not.
 */
export function torpedoWingShip(more: Partial<BoxShip> = {}): ShipSpec {
  const base = torpedoShip(more);
  const [from, to] = [TORPEDO_BULKHEADS[4], TORPEDO_BULKHEADS[5]];
  const compartments = base.compartments.flatMap((c) =>
    c.id !== "c4"
      ? [c]
      : [
          compartment("c4", from, to, 12, {
            span: { side: "centre", y: WING_Y },
          }),
          compartment("c4-port", from, to, 12, {
            span: { side: "port", y: WING_Y },
          }),
          compartment("c4-stbd", from, to, 12, {
            span: { side: "starboard", y: WING_Y },
          }),
        ]
  );
  return { ...base, compartments };
}

/**
 * 120 m × 20 m × 12 m, draught 5 m: three equal holds A, B, C aft to
 * forward (bulkheads at x −20 and 20, to the deck), for watertight doors,
 * the speed profile, the turn and the ram head.
 */
export function threeShip(more: Partial<BoxShip> = {}): ShipSpec {
  const top = 12;
  return boxShip({
    length: 120,
    beam: 20,
    depth: top,
    draught: 5,
    kg: 7,
    compartments: [
      compartment("A", -60, -20, top),
      compartment("B", -20, 20, top),
      compartment("C", 20, 60, top),
    ],
    ...more,
  });
}

/** The tower ship's hull and deckhouse (m). */
export const TOWER = {
  length: 200,
  beam: 30,
  depth: 14,
  draught: 7,
  houseHalfBreadth: 12,
  houseTop: 44,
} as const;

/**
 * 200 m × 30 m × 14 m, draught 7 m, with a deckhouse 24 m wide and 30 m
 * tall along her whole length (a cruise ship's superstructure is most of
 * her height): ten equal holds `h0` (aft) to `h9`, bulkheads to the deck.
 * For the righting lever past the deck edge, the sloping floor, the drift
 * path, heeling moments, the blackout and the rest aground.
 */
export function towerShip(more: Partial<BoxShip> = {}): ShipSpec {
  const t = TOWER;
  return boxShip({
    length: t.length,
    beam: t.beam,
    depth: t.depth,
    draught: t.draught,
    kg: 11,
    compartments: Array.from({ length: 10 }, (_, i) =>
      compartment(`h${i}`, -100 + 20 * i, -80 + 20 * i, t.depth)
    ),
    ...more,
    extra: {
      superstructure: [
        {
          fromX: -t.length / 2,
          toX: t.length / 2,
          topZ: t.houseTop,
          halfBreadthM: t.houseHalfBreadth,
        },
      ],
      boxWaterAtSide: true,
      ...more.extra,
    },
  });
}

/** The tower ship's two deckhouse spaces (box ids), aft and forward. */
export const TOWER_SPACES = ["house-aft", "house-fwd"] as const;

/**
 * The tower ship (a 200 m box hull, a 30 m deckhouse box along her whole
 * length) with trapped air (`trappedAir`, no leaks unless `extra` gives
 * some) and her deckhouse as two named spaces (`TOWER_SPACES`, split
 * amidships), for an upside-down ship: trapped air, boxes as spaces, the
 * righting lever to 180° and keel-up stability.
 */
export function towerSpacesShip(more: Partial<BoxShip> = {}): ShipSpec {
  const t = TOWER;
  return towerShip({
    ...more,
    extra: {
      superstructure: [
        {
          fromX: -t.length / 2,
          toX: 0,
          topZ: t.houseTop,
          halfBreadthM: t.houseHalfBreadth,
          id: TOWER_SPACES[0],
        },
        {
          fromX: 0,
          toX: t.length / 2,
          topZ: t.houseTop,
          halfBreadthM: t.houseHalfBreadth,
          id: TOWER_SPACES[1],
        },
      ],
      trappedAir: { leakM2: {} },
      ...more.extra,
    },
  });
}

/** Her body as the sim builds it, settled upright, before anything opens. */
export function bodyOf(
  spec: ShipSpec,
  openings: readonly Opening[] = []
): Body {
  let body: Body | null = null;
  const runner = createSimRunner(spec, openings, {
    endT: 1,
    probe: (p) => {
      body = body ?? (p.bodies[0] as Body);
    },
  });
  runner.advance(Infinity);
  if (!body) throw new Error("no body");
  return body;
}

/** Hold her at a pose (no motion) for `steps` 1 s steps of flooding. */
export function hold(b: Body, z: number, roll: number, steps: number): void {
  for (let k = 0; k < steps; k += 1) {
    b.z = z;
    b.roll = roll;
    b.pitch = 0;
    b.vx = 0;
    b.vz = 0;
    b.wp = 0;
    b.wr = 0;
    stepFloat(b, SIM_STEP_S, false, 0);
  }
  b.z = z;
  b.roll = roll;
  b.pitch = 0;
}

/** The wave ship's rogue wave: its time (shown s), the rule's peak and pace. */
export const WAVE = {
  t: 30,
  heightM: 30,
  periodS: 15,
  peakDeg: 190,
  rollS: 25,
  smaller: { heightM: 15, peakDeg: 45 },
} as const;

/** The wave ship's spots, aft to forward: `aft-win` and `fwd-win` open the
 *  deckhouse at its foot on her port side, `hold` her hull amidships. */
export const WAVE_SPOTS = ["aft-win", "hold", "fwd-win"] as const;

/**
 * The tower ship with trapped air (`towerSpacesShip`) in a swell (Hs 3 m
 * from her port beam) with a rogue wave from port (`WAVE`, `cause:
 * "wave"`): her blackout by list at 60°, her time ×6 once `capsized`,
 * three spots (`WAVE_SPOTS`, `fwd-win` forward). Spots open at the wave.
 */
export function waveShip(more: Partial<BoxShip> = {}): ShipSpec {
  const t = TOWER;
  const win = (id: string, x: number): Opening => ({
    compartmentId: id,
    areaM2: 4,
    zLow: t.depth,
    zHigh: t.depth + 3,
    x,
    side: "port",
    t: WAVE.t,
  });
  return towerSpacesShip({
    ...more,
    extra: {
      cause: "wave",
      storm: {
        components: stormComponents({
          hsM: 3,
          peakPeriodS: 12,
          dirDeg: -90,
          spreadDeg: 15,
          count: 12,
          seed: 7,
        }),
        hsM: 3,
        windKn: 20,
      },
      wave: {
        group: {
          t: WAVE.t,
          heightM: WAVE.heightM,
          count: 1,
          periodS: WAVE.periodS,
          dirDeg: -90,
        },
        peakDeg: WAVE.peakDeg,
        rollS: WAVE.rollS,
        smaller: WAVE.smaller,
        ahead: { dirDeg: 0 },
        spots: [
          {
            id: "aft-win",
            label: "Back windows",
            openings: [win(TOWER_SPACES[0], -50)],
          },
          {
            id: "hold",
            label: "Hold",
            openings: [{ ...win("h4", -10), zLow: 9, zHigh: 11, areaM2: 1 }],
          },
          {
            id: "fwd-win",
            label: "Front windows",
            openings: [win(TOWER_SPACES[1], 50)],
            fwd: true,
          },
        ],
      },
      blackout: {
        compartmentId: "h5",
        depthM: 1000,
        emergencyLight: 0.2,
        listDeg: 60,
      },
      capsizeTimeScale: 6,
      ...more.extra,
    },
  });
}

/**
 * A plain box with trapped air (100 m × 20 m × 12 m, draught 5 m, kg 6:
 * as stable keel up as upright) and the rogue wave (`WAVE`) from port,
 * `leakM2` from each of her five holds (none by default): for capsized
 * runs that float keel up, and with leaks the dive keel up.
 */
export function keelUpShip(leakM2 = 0, more: Partial<BoxShip> = {}): ShipSpec {
  const base = waveShip();
  return boxShip({
    length: 100,
    beam: 20,
    depth: 12,
    draught: 5,
    kg: 6,
    compartments: Array.from({ length: 5 }, (_, i) =>
      compartment(`k${i}`, -50 + 20 * i, -30 + 20 * i, 12)
    ),
    ...more,
    extra: {
      cause: "wave",
      storm: base.storm,
      wave: {
        ...(base.wave as NonNullable<ShipSpec["wave"]>),
        spots: [
          {
            id: "k2",
            label: "Middle",
            openings: [
              {
                compartmentId: "k2",
                areaM2: 1,
                zLow: 9,
                zHigh: 11,
                x: 0,
                side: "port",
                t: WAVE.t,
              },
            ],
          },
        ],
      },
      capsizeTimeScale: 6,
      trappedAir: { leakM2: { hold: leakM2 } },
      ...more.extra,
    },
  });
}
