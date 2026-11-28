import { concordiaRecipe } from "@/components/shipwreck/model/concordiaRecipe";
import { recipeFor } from "@/components/shipwreck/model/shipModel";
import {
  BOARD_REACH_M,
  boardableBoats,
  boatSpot,
  loweredBoats,
  type BoatSpot,
  nearestBoardable,
  nextBoardable,
  rideLowered,
} from "../boatRide";
import { getShip } from "../ships";
import {
  floorZ,
  insideBlocker,
  pointInPolygon,
  railYAt,
  walkMapFor,
  WALK_RADIUS_M,
  type WalkMap,
} from "../walk";

const events = [
  { t: 50, kind: "rocket" },
  { t: 300, kind: "boat-lowered", index: 4 },
  { t: 100, kind: "boat-lowered", index: 2 },
  { t: 200, kind: "boat-lowered", index: 7 },
  { t: 150, kind: "boat-lowered" },
];

describe("boat ride rules", () => {
  it("boardableBoats lists boats still to be lowered, soonest first", () => {
    expect(boardableBoats(events, 0)).toEqual([2, 7, 4]);
    expect(boardableBoats(events, 150)).toEqual([7, 4]);
    expect(boardableBoats(events, 200)).toEqual([4]);
  });

  it("loweredBoats is the complement of boardableBoats, and a seek back puts boats back", () => {
    const set = new Set<number>();
    expect([...loweredBoats(events, 0, set)]).toEqual([]);
    expect([...loweredBoats(events, 150, set)].sort()).toEqual([2]);
    expect([...loweredBoats(events, 200, set)].sort()).toEqual([2, 7]);
    // Seeking back refills the same set.
    expect(loweredBoats(events, 100, set)).toBe(set);
    expect([...set]).toEqual([2]);
    for (const t of [0, 99, 100, 150, 200, 300, 400]) {
      const out = loweredBoats(events, t);
      const left = boardableBoats(events, t);
      expect([...out, ...left].sort()).toEqual([2, 4, 7]);
      for (const i of left) expect(out.has(i)).toBe(false);
    }
  });

  it("nextBoardable is the soonest, or null when every boat has gone", () => {
    expect(nextBoardable(events, 120)).toBe(7);
    expect(nextBoardable(events, 300)).toBeNull();
    expect(nextBoardable([], 0)).toBeNull();
  });

  it("nearestBoardable picks the closest boat within reach", () => {
    const boats = [
      { index: 2, x: 10, y: 12 },
      { index: 7, x: 13, y: 12 },
      { index: 4, x: 10, y: -12 },
    ];
    expect(BOARD_REACH_M).toBe(3);
    expect(nearestBoardable(12, 10.5, boats)).toBe(7);
    expect(nearestBoardable(10, -9, boats)).toBe(4);
    expect(nearestBoardable(0, 0, boats)).toBeNull();
    expect(nearestBoardable(0, 1, boats, 100)).toBe(2);
  });

  it("nearestBoardable reaches along the boat's whole length (davits stop the walker at its ends)", () => {
    // The Titanic's boat 10: 9 m long at x −38.2; the walker stopped by
    // its davit at x −33.5 on the rail.
    const boat = [{ index: 9, x: -38.2, y: -12.7, halfLength: 4.7 }];
    expect(nearestBoardable(-33.5, -13.7, boat)).toBe(9);
    expect(nearestBoardable(-29, -13.7, boat)).toBeNull();
  });

  it("rideLowered moves the ridden boat's lowering to when they boarded", () => {
    const lowered = new Map([
      [2, 100],
      [7, 200],
    ]);
    rideLowered(lowered, { index: 7, at: 40 });
    expect(lowered.get(7)).toBe(40);
    expect(lowered.get(2)).toBe(100);
    rideLowered(lowered, null);
    expect(lowered.get(7)).toBe(40);
  });
});

describe("boarding the Costa Concordia's boats from her promenade", () => {
  const spec = getShip("concordia");
  const map = walkMapFor("concordia") as WalkMap;
  const recipe = concordiaRecipe(spec);
  // Every boat in reach (none lowered yet), as Effects.tsx builds them.
  const spots: BoatSpot[] = recipe.boats.map((b) => boatSpot(b));

  it.each(recipe.boats.map((b) => [b.label, b.index] as const))(
    "%s: a walker on the promenade's middle beside her gets in",
    (_label, index) => {
      const b = recipe.boats[index];
      const id = b.side === "port" ? "boat-deck-p" : "boat-deck-s";
      const a = map.areas.find((x) => x.id === id)!;
      const s = b.side === "port" ? 1 : -1;
      // The recess wall (the outline's inner side) and the boat's inboard
      // side: the walker in the middle between them.
      const wall = Math.abs(
        railYAt(a.outline, b.x, b.side === "port" ? "starboard" : "port")
      );
      const inboard = Math.abs(b.y) - b.beam / 2;
      const y = (s * (wall + inboard)) / 2;
      expect(pointInPolygon([b.x, y], a.outline)).toBe(true);
      expect(insideBlocker(map, id, [b.x, y], WALK_RADIUS_M)).toBe(false);
      expect(nearestBoardable(b.x, y, spots)).toBe(index);
    }
  );

  it("is reached only from her boat deck, never from the decks over it", () => {
    // The aft lido's starboard walkway is right over boat S7 (x 0) in plan.
    const lido = floorZ(map, "lido-aft", -8, spec);
    const deck = floorZ(map, "boat-deck-s", -8, spec);
    const s7 = recipe.boats.find((b) => b.label === "S7")!;
    expect(s7.x).toBe(0);
    expect(nearestBoardable(-6, -14.2, spots, BOARD_REACH_M, lido)).toBeNull();
    expect(nearestBoardable(-6, -14.2, spots, BOARD_REACH_M, deck)).toBe(
      s7.index
    );
    // Over every boat, from every walked open deck but her boat deck:
    // none (her rooms inside: the next case).
    for (const b of recipe.boats)
      for (const a of map.areas) {
        if (a.id.startsWith("boat-deck") || a.interior) continue;
        for (const dx of [-5, 0, 5]) {
          const p: [number, number] = [b.x + dx, b.y];
          const z = floorZ(map, a.id, p[0], spec);
          expect([
            b.label,
            a.id,
            nearestBoardable(p[0], p[1], spots, BOARD_REACH_M, z),
          ]).toEqual([b.label, a.id, null]);
        }
      }
  });

  it("is never reached from a room inside her, even on the boat deck's own deck", () => {
    let probed = 0;
    for (const a of map.areas) {
      if (!a.interior) continue;
      const xs = a.outline.map((p) => p[0]);
      const ys = a.outline.map((p) => p[1]);
      for (let x = Math.min(...xs) + 0.15; x < Math.max(...xs); x += 0.5)
        for (let y = Math.min(...ys) + 0.15; y < Math.max(...ys); y += 0.5) {
          if (!pointInPolygon([x, y], a.outline)) continue;
          probed += 1;
          const z = floorZ(map, a.id, x, spec, y);
          const got = nearestBoardable(x, y, spots, BOARD_REACH_M, z);
          if (got !== null)
            throw new Error(`${a.id} at ${x}, ${y}: boat ${got}`);
        }
    }
    expect(probed).toBeGreaterThan(1000);
  });

  it("keeps every other ship's spots by her deck edge", () => {
    for (const id of [
      "titanic",
      "britannic",
      "lusitania",
      "carpathia",
    ] as const) {
      const r = recipeFor(getShip(id));
      for (const b of r.boats) {
        if (b.side === "centre") continue;
        const sign = b.side === "port" ? 1 : -1;
        expect(boatSpot(b)).toEqual({
          index: b.index,
          x: b.x,
          y: sign * Math.max(0, Math.abs(b.edgeY) - 1),
          halfLength: b.length / 2,
        });
      }
    }
  });
});
