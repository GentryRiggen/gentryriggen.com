import type { Opening } from "../../ships/types";
import { CD_OPENING, GRAV } from "../constants";
import { simulate } from "../run";
import { sampleTrack } from "../track";
import {
  TOWER,
  TOWER_SPACES,
  bodyOf,
  hold,
  towerShip,
  towerSpacesShip,
} from "./testShips";

/**
 * Superstructure boxes as spaces (`superstructure[i].id`): an opening may
 * name a box, its flood points are its lowest edge at the pose for a ship
 * with trapped air (keel up: its roof's edges) and its ship-frame lower
 * corners otherwise (1.0), and frames carry each box's fill (`boxWater`)
 * only when a box has an id.
 */

/** A 2 m² hole in the forward deckhouse's port side, 10 m above the deck. */
const WINDOW: Opening = {
  compartmentId: TOWER_SPACES[1],
  areaM2: 2,
  zLow: TOWER.depth + 9.5,
  zHigh: TOWER.depth + 10.5,
  x: 50,
  side: "port",
};

describe("an opening that names a box", () => {
  it("opens into that box, at its side", () => {
    const b = bodyOf(towerSpacesShip(), [WINDOW]);
    expect(b.boxes.map((c) => c.openings.length)).toEqual([0, 1]);
    expect(b.cells.every((c) => c.openings.length === 0)).toBe(true);
    expect(b.boxes[1].openings[0].y).toBeCloseTo(TOWER.houseHalfBreadth, 9);
  });

  it("opens into it later too (a timed opening)", () => {
    const seen: number[] = [];
    simulate(towerSpacesShip(), [{ ...WINDOW, t: 2 }], {
      endT: 4,
      probe: (p) => seen.push(p.bodies[0].boxes[1].openings.length),
    });
    expect(seen[0]).toBe(0);
    expect(seen[seen.length - 1]).toBe(1);
  });

  it("floods that box by the orifice law", () => {
    // Upright, held 30 m down (the window 6 m under the sea), one step:
    // the window's water over the box's own (its lower edge is deeper).
    const at = (o: Opening[]) => {
      const b = bodyOf(towerSpacesShip(), o);
      hold(b, -30, 0, 1);
      return b.boxes[1].seaIn;
    };
    const with1 = at([WINDOW]);
    const without = at([]);
    const hs = 30 - (TOWER.depth + 10);
    const want = CD_OPENING * WINDOW.areaM2 * Math.sqrt(2 * GRAV * hs);
    expect(Math.abs(with1 - without - want)).toBeLessThan(0.01 * want);
  });
});

describe("a box's flood points", () => {
  // Keel up, the hull's keel 30 m up: the deckhouse's roof 14 m under the
  // sea, its lower corners (at the deck) 16 m out of it.
  const z = 30;
  it("with trapped air: its lowest edge at the pose (keel up, the roof)", () => {
    const b = bodyOf(towerSpacesShip());
    hold(b, z, Math.PI, 1);
    expect(b.boxes[0].seaIn).toBeGreaterThan(0);
    expect(b.boxes[1].seaIn).toBeGreaterThan(0);
  });

  it("without: its ship-frame lower corners (dry, out of the sea)", () => {
    const b = bodyOf(towerShip());
    hold(b, z, Math.PI, 1);
    expect(b.boxes[0].seaIn).toBe(0);
  });

  it("upright, both are its lower corners", () => {
    const air = bodyOf(towerSpacesShip());
    const plain = bodyOf(towerSpacesShip({ extra: { trappedAir: undefined } }));
    hold(air, -20, 0.1, 1);
    hold(plain, -20, 0.1, 1);
    expect(air.boxes[0].seaIn).toBeGreaterThan(0);
    expect(air.boxes[0].seaIn).toBeCloseTo(plain.boxes[0].seaIn, 6);
  });
});

describe("boxWater", () => {
  const hole: Opening[] = [
    {
      compartmentId: "h5",
      areaM2: 1.5,
      zLow: 1,
      zHigh: 3,
      x: 10,
      side: "starboard",
    },
  ];

  it("is in every frame when a box has an id, one value per box", () => {
    const track = simulate(towerSpacesShip(), hole, { endT: 600 });
    for (const f of track.frames) {
      expect(f.boxWater).toHaveLength(2);
      for (const v of f.boxWater!) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
    expect(sampleTrack(track, 300.5).boxWater).toHaveLength(2);
  });

  it("is missing when no box has one", () => {
    const track = simulate(towerShip(), hole, { endT: 600 });
    expect(track.frames.every((f) => f.boxWater === undefined)).toBe(true);
    expect(sampleTrack(track, 300.5).boxWater).toBeUndefined();
  });
});
