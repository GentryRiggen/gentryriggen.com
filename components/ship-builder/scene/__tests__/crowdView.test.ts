import { BOAT_SHOWN_MAX, LOWER_S } from "@/lib/ship-builder/crowd/evacuation";
import {
  boatAfloatLift,
  boatSeatOffsets,
  carrierOf,
  launchedIdsAt,
  personHeight,
  personWorldTransform,
  PERSON_HALF_WIDTH,
} from "../crowdView";
import { LIFEBOAT_HANG_OFFSET, LIFEBOAT_HULLS } from "../lifeboatHulls";
import { DECK_Y, LEVEL_HEIGHT } from "../coords";
import type { PersonPose } from "@/lib/ship-builder/crowd/types";
import type { WalkGrid } from "@/lib/ship-builder/walk";

const grid = {
  stairs: [],
  surfaceHeight: (_x: number, _z: number, level: number) =>
    level === 1 ? 0.9 : level,
} as unknown as WalkGrid;

function pose(over: Partial<PersonPose> = {}): PersonPose {
  return { x: 3.5, z: 1.5, level: 0, yaw: 0, activity: "walk", ...over };
}

describe("personWorldTransform", () => {
  it("maps model x and z to world x and z", () => {
    const t = personWorldTransform(pose(), grid, 40, 6);
    expect(t.x).toBeCloseTo(20 - 3.5);
    expect(t.z).toBeCloseTo(3 - 1.5);
  });

  it("stands on the floor height of the level", () => {
    expect(personWorldTransform(pose(), grid, 40, 6).y).toBeCloseTo(DECK_Y);
    expect(personWorldTransform(pose({ level: 2 }), grid, 40, 6).y).toBeCloseTo(
      DECK_Y + 2 * LEVEL_HEIGHT
    );
  });

  it("uses the surface height where a roof sits a little low", () => {
    expect(personWorldTransform(pose({ level: 1 }), grid, 40, 6).y).toBeCloseTo(
      DECK_Y + 0.9 * LEVEL_HEIGHT
    );
  });

  it("turns the figure so yaw 0 faces the bow (world +X)", () => {
    const rotation = (yaw: number) =>
      personWorldTransform(pose({ yaw }), grid, 40, 6).rotationY;
    // A mesh facing local +X rotated by r faces (cos r, -sin r) in (x, z).
    const facing = (r: number) => [Math.cos(r), -Math.sin(r)];
    expect(facing(rotation(0))[0]).toBeCloseTo(1);
    expect(facing(rotation(0))[1]).toBeCloseTo(0);
    // Yaw PI / 2 looks to starboard, world +Z.
    expect(facing(rotation(Math.PI / 2))[0]).toBeCloseTo(0);
    expect(facing(rotation(Math.PI / 2))[1]).toBeCloseTo(1);
  });
});

describe("personHeight on stairs", () => {
  // Stairs in cell (3, 1) on level 0 climb to the block roof at (4, 1).
  const stairs = [
    { from: { x: 3, z: 1, level: 0 }, to: { x: 4, z: 1, level: 1 } },
    { from: { x: 4, z: 1, level: 1 }, to: { x: 3, z: 1, level: 0 } },
  ];
  const stairGrid = {
    stairs,
    surfaceHeight: (_x: number, _z: number, level: number) => level,
  } as unknown as WalkGrid;
  /** The level the planner reports: the cell's own, switching at the edge. */
  const levelAt = (x: number) => (Math.floor(x) >= 4 ? 1 : 0);

  it("is the floor away from the stairs", () => {
    expect(personHeight(stairGrid, 2.5, 1.5, 0)).toBe(0);
    expect(personHeight(stairGrid, 4.5, 1.5, 1)).toBe(1);
  });

  it("climbs across the stair cell, half way up at its centre", () => {
    expect(personHeight(stairGrid, 3.5, 1.5, 0)).toBeCloseTo(0.5);
    expect(personHeight(stairGrid, 3.01, 1.5, 0)).toBeCloseTo(0.01, 1);
    expect(personHeight(stairGrid, 3.99, 1.5, 0)).toBeCloseTo(0.99, 1);
  });

  it("never jumps walking up from the deck to the roof and back", () => {
    let previous = personHeight(stairGrid, 2.5, 1.5, levelAt(2.5));
    for (let x = 2.5; x <= 4.5; x += 0.01) {
      const height = personHeight(stairGrid, x, 1.5, levelAt(x));
      expect(Math.abs(height - previous)).toBeLessThan(0.03);
      previous = height;
    }
    expect(previous).toBeCloseTo(1);
  });

  it("steps on smoothly from the side of the stairs", () => {
    let previous = personHeight(stairGrid, 3.5, 0.5, 0);
    for (let z = 0.5; z <= 1.5; z += 0.01) {
      const height = personHeight(stairGrid, 3.5, z, 0);
      expect(Math.abs(height - previous)).toBeLessThan(0.03);
      previous = height;
    }
    expect(previous).toBeCloseTo(0.5);
  });

  it("lifts the world transform with the stairs", () => {
    const t = personWorldTransform(
      { x: 3.5, z: 1.5, level: 0, yaw: 0, activity: "walk" },
      stairGrid,
      40,
      6
    );
    expect(t.y).toBeCloseTo(DECK_Y + 0.5 * LEVEL_HEIGHT);
  });
});

describe("carrierOf", () => {
  it("is the whole ship until she breaks", () => {
    expect(carrierOf(3, null)).toBe("whole");
    expect(carrierOf(30, null)).toBe("whole");
  });

  it("is the half the person stands on once broken", () => {
    expect(carrierOf(3.5, 10)).toBe("bow");
    expect(carrierOf(9.99, 10)).toBe("bow");
    expect(carrierOf(10, 10)).toBe("stern");
    expect(carrierOf(25, 10)).toBe("stern");
  });
});

describe("boatSeatOffsets", () => {
  const hull = { length: 0.9, width: 0.35, depth: 0.3 };

  it("seats every rider, in one row up to BOAT_SHOWN_MAX", () => {
    expect(boatSeatOffsets(0, hull)).toHaveLength(0);
    expect(boatSeatOffsets(2, hull)).toHaveLength(2);
    expect(boatSeatOffsets(4, hull)).toHaveLength(BOAT_SHOWN_MAX);
    expect(
      new Set(boatSeatOffsets(BOAT_SHOWN_MAX, hull).map((s) => s.z)).size
    ).toBe(1);
    expect(boatSeatOffsets(9, hull)).toHaveLength(9);
  });

  it("packs a full boat in two rows, all inside the hull, none on top of another", () => {
    for (const type of Object.keys(LIFEBOAT_HULLS)) {
      const size = LIFEBOAT_HULLS[type];
      for (const n of [5, 9, 24]) {
        const seats = boatSeatOffsets(n, size);
        expect(seats).toHaveLength(n);
        expect(new Set(seats.map((s) => `${s.x},${s.z}`)).size).toBe(n);
        for (const seat of seats) {
          expect(Math.abs(seat.x) + PERSON_HALF_WIDTH).toBeLessThanOrEqual(
            size.length / 2
          );
          expect(Math.abs(seat.z)).toBeLessThan(size.width / 2);
        }
      }
    }
  });

  it("spreads them along the boat's length, inside its hull", () => {
    const seats = boatSeatOffsets(4, hull);
    const xs = seats.map((seat) => seat.x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
    expect(new Set(xs).size).toBe(4);
    for (const seat of seats) {
      expect(Math.abs(seat.x) + PERSON_HALF_WIDTH).toBeLessThanOrEqual(
        hull.length / 2
      );
      expect(Math.abs(seat.z) + PERSON_HALF_WIDTH).toBeLessThanOrEqual(
        hull.width / 2
      );
    }
    // Centred on the boat.
    expect(xs[0] + xs[3]).toBeCloseTo(0);
  });

  it("fits four in the big boat and the small one alike", () => {
    for (const type of Object.keys(LIFEBOAT_HULLS)) {
      const size = LIFEBOAT_HULLS[type];
      for (const seat of boatSeatOffsets(4, size)) {
        expect(Math.abs(seat.x) + PERSON_HALF_WIDTH).toBeLessThanOrEqual(
          size.length / 2
        );
      }
    }
  });
});

describe("boatAfloatLift", () => {
  const hull = { length: 0.9, width: 0.35, depth: 0.3 };

  it("is nothing on the davit and floats the hull once down", () => {
    expect(boatAfloatLift(hull, 0)).toBe(0);
    expect(boatAfloatLift(hull, -1)).toBe(0);
    const full = boatAfloatLift(hull, LOWER_S);
    // The rim hangs below the hang point; afloat it rides above the water.
    expect(full).toBeGreaterThan(LIFEBOAT_HANG_OFFSET);
    expect(full).toBeLessThan(LIFEBOAT_HANG_OFFSET + hull.depth);
    expect(boatAfloatLift(hull, LOWER_S * 3)).toBeCloseTo(full);
  });

  it("rises steadily while lowering", () => {
    let previous = 0;
    for (let s = 0; s <= LOWER_S; s += 0.1) {
      const lift = boatAfloatLift(hull, s);
      expect(lift).toBeGreaterThanOrEqual(previous - 1e-12);
      previous = lift;
    }
  });
});

describe("launchedIdsAt", () => {
  const launches = [
    { boatId: "b1", at: 3 },
    { boatId: "b2", at: 8 },
  ];

  it("has each boat from its launch on, and none before", () => {
    expect(launchedIdsAt(launches, 0)).toEqual(new Set());
    expect(launchedIdsAt(launches, 3)).toEqual(new Set(["b1"]));
    expect(launchedIdsAt(launches, 9)).toEqual(new Set(["b1", "b2"]));
    // Scrubbing back hangs it up again.
    expect(launchedIdsAt(launches, 5)).toEqual(new Set(["b1"]));
  });
});
