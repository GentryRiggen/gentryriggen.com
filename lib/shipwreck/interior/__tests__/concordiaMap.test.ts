import { createHash } from "crypto";
import { concordiaRecipe } from "@/components/shipwreck/model/concordiaRecipe";
import { concordia, CONCORDIA_BOATS, DECK3_Z } from "../../ships/concordia";
import {
  CONCORDIA_HALL_POOL,
  CONCORDIA_POOL_GLASS,
} from "../../ships/concordiaLayout";
import { buildHull, hullHalfBreadth } from "../../sim/geometry";
import type { BodyPose, SimFrame } from "../../sim/track";
import toSea from "../../sim/__tests__/fixtures/concordiaToSea.json";
import {
  CONCORDIA_WALK,
  floorZ,
  insideBlocker,
  pointInPolygon,
  stepWalker,
  walkMapFor,
  WALK_DT,
  WALK_RADIUS_M,
  WALK_SPEED_MS,
  type StepContext,
  type V2,
  type WalkInput,
  type WalkMap,
  type WalkerState,
} from "../../walk";
import {
  BALCONY_DEPTH_M,
  CONCORDIA_INTERIOR,
  POOL_HALL_EAVES_M,
} from "../concordia";
import { openEntries } from "../entries";
import {
  DOOR_MIN_M,
  PIECE_FOOTPRINT,
  pieceBlocker,
  pieceFootprint,
  signedArea,
} from "../kit";
import {
  deckRoomWalk,
  LIFT_CAR_CEILING_M,
  liftCars,
  withInterior,
} from "../merge";
import {
  MODERN_PIECE_MOUNT,
  POOL_BASIN_LX,
  POOL_BASIN_LY,
  seatRowFootprint,
} from "../modernPieces";
import { TITANIC_INTERIOR } from "../titanic";
import type { Room } from "../types";
import { roomFloorZ, roomWaterTargets } from "../water";
import { interiorFor } from "..";

/**
 * Her interior in 1.17: the pool hall, a deck room. It merges as an open
 * deck (deck speed, jumping, never closed), its one source the interior's
 * data (the deck map takes it from there), and it holds together: its
 * outline is her model's glass block, its pool and loungers block the
 * walker and leave the spawn and the stairs clear. Plus her boats' blockers,
 * gone once each boat is lowered.
 */

const spec = concordia;
const interior = CONCORDIA_INTERIOR;
const map = walkMapFor("concordia") as WalkMap;
const hall = interior.rooms.find((r) => r.id === "pool-hall")!;
const roomIds = new Set(interior.rooms.map((r) => r.id));
const STILL: WalkInput = { forward: 0, strafe: 0, lookDx: 0, lookDy: 0 };
const LEVEL: BodyPose = {
  part: "whole",
  x: 0,
  y: 0,
  z: -spec.draught,
  pitch: 0,
  roll: 0,
  yaw: 0,
};

function ctx(extra: Partial<StepContext> = {}): StepContext {
  return { map, spec, pose: LEVEL, breakX: null, seaZ: () => -1000, ...extra };
}

function run(
  w: WalkerState,
  input: WalkInput,
  c: StepContext,
  seconds: number
): WalkerState {
  let s = w;
  for (let i = 0; i < Math.round(seconds / WALK_DT); i += 1)
    s = stepWalker(
      s,
      i === 0 ? input : { ...input, jump: false },
      c,
      WALK_DT
    ).state;
  return s;
}

describe("the Concordia's interior (1.17: the pool hall)", () => {
  it("is hers, from the registry, the pool hall first (its only deck room)", () => {
    expect(interiorFor("concordia")).toBe(interior);
    expect(interior.ship).toBe("concordia");
    expect(interior.rooms[0].id).toBe("pool-hall");
    expect(interior.rooms.filter((r) => r.deckRoom)).toEqual([hall]);
    expect(hall.deckRoom).toBe(true);
    expect(hall.kind).toBe("pool-hall");
    expect(hall.look.finish).toBe("glass");
    expect(hall.look.floor).toBe("tile");
    // No doorway or lift into the hall: only her deck door to the club.
    expect(
      interior.seams.some((s) => s.a === "pool-hall" || s.b === "pool-hall")
    ).toBe(false);
    expect(
      interior.links
        .filter((l) => l.from.area === "pool-hall" || l.to.area === "pool-hall")
        .map((l) => l.id)
    ).toEqual(["squok"]);
  });

  it("lays the hall in her model's glass block: counter-clockwise, its ends solid, as high as the lidos", () => {
    const { x0, x1, halfWidth } = CONCORDIA_POOL_GLASS;
    expect(signedArea(hall.outline)).toBeGreaterThan(0);
    for (const [x, y] of hall.outline) {
      expect([x0, x1]).toContain(x);
      expect(Math.abs(y)).toBe(halfWidth);
    }
    // The ends (across her) are solid; the sides glass.
    for (const i of hall.look.solidEdges ?? []) {
      const a = hall.outline[i];
      const b = hall.outline[(i + 1) % hall.outline.length];
      expect(a[0]).toBe(b[0]);
    }
    expect(hall.look.solidEdges).toHaveLength(2);
    const lido = floorZ(map, "lido-aft", 0, spec);
    expect(floorZ(map, "pool-hall", 0, spec) + POOL_HALL_EAVES_M).toBeCloseTo(
      lido,
      6
    );
    expect(hall.ceilingM).toBe(POOL_HALL_EAVES_M);
  });

  it("merges the pool hall as an open-deck area, once, walled all round, keeping its kind", () => {
    const halls = map.areas.filter((a) => a.id === "pool-hall");
    expect(halls).toHaveLength(1);
    const a = halls[0];
    expect(a.interior).toBeUndefined();
    expect(a.kind).toBe("pool-hall");
    expect(a.outline).toEqual(hall.outline);
    expect(a.wallEdges).toEqual(hall.outline.map((_, i) => i));
    // The deck map takes it from the interior: merging adds nothing twice.
    const deckHall = CONCORDIA_WALK.areas.find((x) => x.id === "pool-hall");
    expect(deckHall).toEqual(a);
    const byArea = (a: { id: string }, b: { id: string }) =>
      a.id < b.id ? -1 : 1;
    expect(map.areas.filter((x) => !x.interior).sort(byArea)).toEqual(
      [...CONCORDIA_WALK.areas].sort(byArea)
    );
    // Her open decks' blockers once each; her rooms' furniture added.
    const deckOnes = map.blockers.filter(
      (b) => b.area === "pool-hall" || !roomIds.has(b.area)
    );
    expect(deckOnes).toHaveLength(CONCORDIA_WALK.blockers.length);
    for (const b of CONCORDIA_WALK.blockers) expect(deckOnes).toContainEqual(b);
    expect(withInterior(CONCORDIA_WALK, interior).blockers).toEqual(
      map.blockers
    );
    const hallBlockers = deckRoomWalk(interior).blockers;
    expect(map.blockers.filter((b) => b.area === "pool-hall")).toEqual(
      hallBlockers
    );
    // Her lean's flags come through the merge.
    expect(map.eyesShipUp).toBe(true);
    expect(map.heelFeel).toBe(true);
    expect(map.swimAroundSuperstructure).toBe(true);
    expect(map.walkEndsAtHeelDeg).toBe(40);
  });

  it("blocks the pool's basin (its coping walkable) and every lounger, clear of the spawn and the stairs", () => {
    const pool = interior.furniture[0];
    expect(pool.piece).toBe("pool-edge");
    expect(pool.at).toEqual(CONCORDIA_HALL_POOL.c);
    expect(CONCORDIA_HALL_POOL.size).toEqual([POOL_BASIN_LX, POOL_BASIN_LY]);
    const basin = pieceBlocker(pool);
    // The hall's first blocker is the basin (the walk tests find it so).
    expect(map.blockers.find((b) => b.area === "pool-hall")).toEqual(basin);
    expect(PIECE_FOOTPRINT["pool-edge"]).toBeUndefined();
    expect(pieceFootprint("pool-edge")).toEqual({
      lx: POOL_BASIN_LX,
      ly: POOL_BASIN_LY,
    });
    // The coping, 0.2 m past the basin, is walkable.
    const [cx, cy] = CONCORDIA_HALL_POOL.c;
    expect(insideBlocker(map, "pool-hall", [cx, cy], 0)).toBe(true);
    expect(
      insideBlocker(map, "pool-hall", [cx, cy + POOL_BASIN_LY / 2 + 0.2], 0)
    ).toBe(false);
    const loungers = interior.furniture.filter((f) => f.piece === "lounger");
    expect(loungers.length).toBeGreaterThanOrEqual(20);
    for (const f of loungers) {
      expect(f.blocks).toBe(true);
      expect(insideBlocker(map, "pool-hall", f.at, 0)).toBe(true);
      // Inside the hall, square to her.
      expect(pointInPolygon(f.at, hall.outline)).toBe(true);
      expect(Math.abs(Math.sin(2 * f.yaw))).toBeLessThan(1e-9);
    }
    expect(insideBlocker(map, "pool-hall", map.spawn.at, 1)).toBe(false);
    for (const st of map.stairs)
      for (const end of [st.from, st.to])
        if (end.area === "pool-hall")
          expect([
            st.id,
            insideBlocker(map, "pool-hall", end.at, WALK_RADIUS_M + 0.5),
          ]).toEqual([st.id, false]);
  });

  it("walks the hall at deck speed and jumps in it", () => {
    const start: WalkerState = {
      part: "whole",
      area: "pool-hall",
      x: 4,
      y: -7,
      yaw: 0,
    };
    const end = run(start, { ...STILL, forward: 1 }, ctx(), 1);
    expect(end.area).toBe("pool-hall");
    expect(end.x - start.x).toBeCloseTo(WALK_SPEED_MS, 1);
    const r = stepWalker(start, { ...STILL, jump: true }, ctx(), WALK_DT);
    expect(r.state.jumpS).not.toBeNull();
    expect(r.state.jumpS).toBeDefined();
  });

  it("never closes: with interiors closed a walker still goes down into it from either lido", () => {
    for (const id of ["pool-hall-aft", "pool-hall-fwd"]) {
      const st = map.stairs.find((s) => s.id === id)!;
      const lido = st.from.area === "pool-hall" ? st.to : st.from;
      const into = st.from.area === "pool-hall" ? st.from : st.to;
      // Toward the stair's lido end from 2 m off it.
      const dir = Math.sign(into.at[0] - lido.at[0]);
      const w: WalkerState = {
        part: "whole",
        area: lido.area,
        x: lido.at[0] - dir * 2,
        y: lido.at[1],
        yaw: dir > 0 ? 0 : Math.PI,
      };
      const end = run(
        w,
        { ...STILL, forward: 1 },
        ctx({ interiorsOpen: false }),
        1
      );
      expect([id, end.area]).toEqual([id, "pool-hall"]);
    }
  });
});

describe("her boats' blockers", () => {
  it("tag each boat on her boat deck with its index", () => {
    const tagged = map.blockers.filter(
      (b) => b.kind === "box" && b.boat !== undefined
    );
    expect(tagged).toHaveLength(CONCORDIA_BOATS.length);
    expect(
      tagged
        .map((b) => (b.kind === "box" ? (b.boat ?? -1) : -1))
        .sort((a, b) => a - b)
    ).toEqual(CONCORDIA_BOATS.map((b) => b.index).sort((a, b) => a - b));
    // No other ship's map tags a boat.
    for (const id of [
      "titanic",
      "lusitania",
      "britannic",
      "carpathia",
    ] as const)
      expect(
        walkMapFor(id)!.blockers.some(
          (b) => b.kind === "box" && b.boat !== undefined
        )
      ).toBe(false);
  });

  it("hold the walker until that boat is lowered, then let them into its gap", () => {
    const boat = CONCORDIA_BOATS[0];
    const b = map.blockers.find(
      (x) => x.kind === "box" && x.boat === boat.index
    );
    if (b?.kind !== "box") throw new Error("no boat blocker");
    const area = b.area;
    // Inboard of the boat, walking outboard across its middle.
    const s = b.min[1] > 0 ? 1 : -1;
    const inboardY = s > 0 ? b.min[1] - 0.6 : b.max[1] + 0.6;
    const w: WalkerState = {
      part: "whole",
      area,
      x: boat.x,
      y: inboardY,
      yaw: s > 0 ? Math.PI / 2 : -Math.PI / 2,
    };
    const go = { ...STILL, forward: 1 };
    const held = run(w, go, ctx(), 1);
    expect(
      insideBlocker(map, area, [held.x, held.y], WALK_RADIUS_M - 1e-6)
    ).toBe(false);
    expect(Math.abs(held.y - inboardY)).toBeLessThan(0.7);
    // Another boat lowered: still held.
    const other = run(w, go, ctx({ boatLowered: (i) => i !== boat.index }), 1);
    expect(other.y).toBeCloseTo(held.y, 6);
    // This one lowered: into the gap it left, out toward her rail.
    const free = run(w, go, ctx({ boatLowered: (i) => i === boat.index }), 1);
    expect(Math.abs(free.y - inboardY)).toBeGreaterThan(1);
    expect(free.area).toBe(area);
  });
});

// --- 1.18: her rooms (blockout) ---------------------------------------------------

/**
 * Her rooms hold together, as titanicMap.test.ts holds the Titanic's: clean
 * outlines, real doorways at one floor height, every room reachable from a
 * deck door (by seams, doors and the lifts' stops), link ends clear,
 * headroom, every room inside her model's solid blocks, the atrium's well
 * open, the theatre's aisles clear, and the picker's entries standing in
 * their rooms facing what is worth seeing.
 */

const lifted = liftCars(interior);
const allRooms: readonly Room[] = [...interior.rooms, ...lifted.rooms];
const allSeams = [...interior.seams, ...lifted.seams];
const allLinks = [...interior.links];
const byId = new Map(allRooms.map((r) => [r.id, r]));
const walkable = allRooms.filter((r) => !r.noWalk);
/** Her rooms inside (not the pool hall, a deck room). */
const inside = allRooms.filter((r) => !r.deckRoom);
const TOL = 1e-3;
const near = (p: V2, q: V2) =>
  Math.abs(p[0] - q[0]) <= TOL && Math.abs(p[1] - q[1]) <= TOL;
const Z = (deck: string) => spec.decks.find((d) => d.name === deck)!.z;

function edges(poly: readonly V2[]): [V2, V2][] {
  return poly.map((a, i) => [a, poly[(i + 1) % poly.length]]);
}

function segDist(p: V2, a: V2, b: V2): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const u =
    len2 > 0
      ? Math.max(
          0,
          Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2)
        )
      : 0;
  return Math.hypot(p[0] - (a[0] + u * dx), p[1] - (a[1] + u * dy));
}

function segmentsCross(a: V2, b: V2, c: V2, d: V2): boolean {
  const o = (p: V2, q: V2, r: V2) =>
    (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = o(c, d, a);
  const d2 = o(c, d, b);
  const d3 = o(a, b, c);
  const d4 = o(a, b, d);
  if (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  )
    return true;
  return (
    segDist(a, c, d) < 1e-9 ||
    segDist(b, c, d) < 1e-9 ||
    segDist(c, a, b) < 1e-9 ||
    segDist(d, a, b) < 1e-9
  );
}

function seamEdgeIndex(room: Room, at: readonly [V2, V2]): number {
  const [p, q] = at;
  return edges(room.outline).findIndex(
    ([a, b]) => (near(a, p) && near(b, q)) || (near(a, q) && near(b, p))
  );
}

function seamsOf(id: string): (readonly [V2, V2])[] {
  return allSeams.filter((s) => s.a === id || s.b === id).map((s) => s.at);
}

function isSeamEdge(id: string, a: V2, b: V2): boolean {
  return seamsOf(id).some(
    ([p, q]) => (near(a, p) && near(b, q)) || (near(a, q) && near(b, p))
  );
}

/** Ship-frame z of a room's ceiling: over its floor (a ramp's higher end). */
function ceilingZ(room: Room, x: number, y: number): number {
  if (!room.ramp) return roomFloorZ(room, x, y, spec) + room.ceilingM;
  const [fx, fy] = room.ramp.from;
  return roomFloorZ(room, fx, fy, spec) + room.ceilingM;
}

const box = (o: readonly V2[]) => {
  const xs = o.map((p) => p[0]);
  const ys = o.map((p) => p[1]);
  return {
    x0: Math.min(...xs),
    x1: Math.max(...xs),
    y0: Math.min(...ys),
    y1: Math.max(...ys),
  };
};

const SPEC_ROOMS = [
  "atrium-3",
  "atrium-3-fwd",
  "atrium-well",
  "atrium-4",
  "atrium-4-fwd",
  "atrium-5",
  "atrium-5-fwd",
  "atrium-stair",
  "entry-p",
  "entry-s",
  "lobby-1",
  "corridor-1",
  "cabin-inside",
  "cabin-ocean",
  "lobby-7",
  "corridor-7",
  "stateroom",
  "balcony",
  "theatre-passage",
  "theatre-back",
  "theatre",
  "stage-steps-p",
  "stage-steps-s",
  "stage",
  "theatre-passage-5",
  "theatre-balcony",
  "squok",
];

describe("her rooms (1.18)", () => {
  it("has the spec's rooms, her close at 30°, the flicker, and seep in the low rooms", () => {
    const ids = interior.rooms.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(["pool-hall", ...SPEC_ROOMS].sort());
    expect(interior.closeAtHeelDeg).toBe(30);
    expect(interior.emergencyFlicker).toBe(true);
    expect(
      interior.rooms
        .filter((r) => r.seep)
        .map((r) => r.id)
        .sort()
    ).toEqual(["cabin-inside", "cabin-ocean", "corridor-1", "lobby-1"]);
    for (const r of interior.rooms.filter((x) => x.seep))
      expect([r.id, r.deck]).toEqual([r.id, "0"]);
    // Every room of hers is inside her except the pool hall.
    for (const id of SPEC_ROOMS)
      expect([id, map.areas.find((a) => a.id === id)?.interior]).toEqual([
        id,
        true,
      ]);
  });

  it("has two glass lifts on the atrium's after wall, stopping at decks 0 (the low lobby), 3, 4, 5 and 7", () => {
    const lifts = interior.lifts ?? [];
    expect(lifts.map((l) => l.id)).toEqual(["lift-a", "lift-b"]);
    for (const l of lifts) {
      expect(l.stops.map((s) => s.deck)).toEqual(["0", "3", "4", "5", "7"]);
      expect(l.stops.map((s) => s.landing)).toEqual([
        "lobby-1",
        "atrium-3",
        "atrium-4",
        "atrium-5",
        "lobby-7",
      ]);
      expect(l.car.min[0]).toBe(62);
      expect(l.car.max[0]).toBeCloseTo(64.2, 9);
      expect(l.car.max[0] - l.car.min[0]).toBeCloseTo(2.2, 9);
      expect(l.car.max[1] - l.car.min[1]).toBeCloseTo(2.2, 9);
    }
    // Port and starboard of the centre line.
    expect(lifts[0].car.min[1]).toBeGreaterThan(0);
    expect(lifts[1].car.max[1]).toBeLessThan(0);
  });

  it("merges one lift-car area per stop, seamed to its landing, and no lift links (the cars ride)", () => {
    for (const l of interior.lifts ?? []) {
      for (const s of l.stops) {
        const id = `${l.id}@${s.deck}`;
        const a = map.areas.find((x) => x.id === id);
        expect([id, a?.kind, a?.interior, a?.deck]).toEqual([
          id,
          "lift-car",
          true,
          s.deck,
        ]);
        expect(
          map.seams!.some(
            (m) =>
              ((m.a === id && m.b === s.landing) ||
                (m.b === id && m.a === s.landing)) &&
              near(m.at[0], s.door[0]) &&
              near(m.at[1], s.door[1])
          )
        ).toBe(true);
        expect(byId.get(id)!.ceilingM).toBe(LIFT_CAR_CEILING_M);
      }
    }
    // No links between a shaft's cars: the ride (lift.ts) takes the walker.
    expect(map.stairs.filter((st) => st.kind === "lift")).toEqual([]);
    expect(map.lifts).toBe(interior.lifts);
    // The Titanic has no shafts: nothing added.
    expect(liftCars(TITANIC_INTERIOR)).toEqual({ rooms: [], seams: [] });
  });

  it("lays every room on one of her decks, counter-clockwise and simple", () => {
    const decks = spec.decks.map((d) => d.name);
    for (const r of allRooms) {
      expect([r.id, decks.includes(r.deck)]).toEqual([r.id, true]);
      expect([r.id, signedArea(r.outline) > 0]).toEqual([r.id, true]);
      const es = edges(r.outline);
      for (const [a, b] of es)
        expect([r.id, Math.hypot(b[0] - a[0], b[1] - a[1]) > 0.05]).toEqual([
          r.id,
          true,
        ]);
      for (let i = 0; i < es.length; i += 1)
        for (let j = i + 2; j < es.length; j += 1) {
          if (i === 0 && j === es.length - 1) continue;
          expect([r.id, i, j, segmentsCross(...es[i], ...es[j])]).toEqual([
            r.id,
            i,
            j,
            false,
          ]);
        }
      expect(r.ceilingM).toBeGreaterThan(0);
      expect(r.zone.length).toBeGreaterThan(0);
    }
  });

  it("stands every room inside her model's solid blocks and under their roofs (the balcony out on its own)", () => {
    const recipe = concordiaRecipe(spec);
    const edgeAt = (x: number) => recipe.hull.topHalfBreadth(x);
    const hull = buildHull(spec);
    const blocks = recipe.blocks ?? [];
    /**
     * Whether the plan x0..x1, |y| ≤ y is inside her blocks at height z
     * (each x in one: the blocks abut, the recess's end and the deck 4
     * block forward of it, say).
     */
    const covered = (x0: number, x1: number, y: number, z: number) => {
      const xs: number[] = [];
      for (let x = x0; x < x1; x += 0.5) xs.push(x);
      xs.push(x1);
      if (z < DECK3_Z - 1e-6)
        // Her hull below deck 3 (its sides 0.3 m in).
        return xs.every((x) => y < hullHalfBreadth(hull, x, z) - 0.3);
      return xs.every((x) =>
        blocks.some((b) => {
          const z0 = recipe.deckZ(b.deck, x) + (b.dz ?? 0);
          if (z < z0 - 1e-6 || z > z0 + b.h + 1e-6) return false;
          if (x < b.x0 - 1e-6 || x > b.x1 + 1e-6) return false;
          return y <= (b.halfWidth ?? edgeAt(x) - (b.inset ?? 0)) + 1e-6;
        })
      );
    };
    for (const r of allRooms) {
      if (r.deckRoom) continue;
      const b = box(r.outline);
      if (r.kind === "balcony") {
        // Out past the balcony wall (the model's), inside her edge.
        const wall = blocks.find((k) => k.id === "balcony-wall")!;
        expect(wall.inset).toBe(BALCONY_DEPTH_M);
        for (const [x, y] of r.outline) {
          // (The model's walls are polylines: within a centimetre.)
          expect(Math.abs(y)).toBeGreaterThanOrEqual(
            edgeAt(x) - BALCONY_DEPTH_M - 0.01
          );
          expect(Math.abs(y)).toBeLessThan(edgeAt(x));
          expect(x).toBeGreaterThanOrEqual(wall.x0);
          expect(x).toBeLessThanOrEqual(wall.x1);
        }
        continue;
      }
      let lo = Infinity;
      let hi = -Infinity;
      for (let x = b.x0; x <= b.x1 + 1e-9; x += 0.25)
        for (const y of [b.y0, b.y1]) {
          lo = Math.min(lo, roomFloorZ(r, x, y, spec));
          hi = Math.max(hi, ceilingZ(r, x, y));
        }
      const y = Math.max(Math.abs(b.y0), Math.abs(b.y1));
      const zs: number[] = [];
      for (let z = lo; z < hi; z += 0.25) zs.push(z);
      zs.push(hi);
      for (const z of zs)
        expect([r.id, +z.toFixed(2), covered(b.x0, b.x1, y, z)]).toEqual([
          r.id,
          +z.toFixed(2),
          true,
        ]);
    }
  });

  it("makes every seam an edge of both rooms, at least a doorway wide, with the floors level across it", () => {
    expect(allSeams.length).toBeGreaterThan(20);
    for (const s of allSeams) {
      const a = byId.get(s.a);
      const b = byId.get(s.b);
      expect([s.a, s.b, !!a, !!b]).toEqual([s.a, s.b, true, true]);
      if (!a || !b) continue;
      expect([s.a, s.b, !a.noWalk && !b.noWalk]).toEqual([s.a, s.b, true]);
      expect([s.a, s.b, seamEdgeIndex(a, s.at) >= 0]).toEqual([s.a, s.b, true]);
      expect([s.a, s.b, seamEdgeIndex(b, s.at) >= 0]).toEqual([s.a, s.b, true]);
      const [p, q] = s.at;
      expect(Math.hypot(q[0] - p[0], q[1] - p[1])).toBeGreaterThanOrEqual(
        DOOR_MIN_M - 1e-9
      );
      for (let k = 0; k <= 10; k += 1) {
        const x = p[0] + ((q[0] - p[0]) * k) / 10;
        const y = p[1] + ((q[1] - p[1]) * k) / 10;
        const za = floorZ(map, s.a, x, spec, y);
        const zb = floorZ(map, s.b, x, spec, y);
        expect([s.a, s.b, k, Math.abs(za - zb) <= 0.02]).toEqual([
          s.a,
          s.b,
          k,
          true,
        ]);
      }
    }
  });

  it("merges every seam into the walk map, where the walker finds it on both sides", () => {
    for (const s of allSeams) {
      expect(map.seams).toContainEqual(s);
      for (const self of [s.a, s.b]) {
        const area = map.areas.find((x) => x.id === self)!;
        const hit = edges(area.outline).some(
          ([a, b]) =>
            (near(a, s.at[0]) && near(b, s.at[1])) ||
            (near(a, s.at[1]) && near(b, s.at[0]))
        );
        expect([self, s.a, s.b, hit]).toEqual([self, s.a, s.b, true]);
      }
    }
  });

  it("leaves no reflex corner sharper than a chamfer's except at a seam's end", () => {
    const MAX_TURN = Math.PI / 4 + 1e-6;
    for (const r of walkable) {
      const n = r.outline.length;
      const ends = seamsOf(r.id).flat();
      for (let i = 0; i < n; i += 1) {
        const p = r.outline[(i + n - 1) % n];
        const c = r.outline[i];
        const q = r.outline[(i + 1) % n];
        const ax = c[0] - p[0];
        const ay = c[1] - p[1];
        const bx = q[0] - c[0];
        const by = q[1] - c[1];
        const turn = Math.atan2(ax * by - ay * bx, ax * bx + ay * by);
        if (turn >= -MAX_TURN) continue;
        expect([r.id, c, ends.some((e) => near(e, c))]).toEqual([
          r.id,
          c,
          true,
        ]);
      }
    }
  });

  it("has three deck doors: the boat deck's two into the atrium, and the club's from the pool hall", () => {
    const doors = interior.links.filter((l) => l.kind === "door");
    expect(doors.map((d) => [d.id, d.from.area, d.to.area]).sort()).toEqual(
      [
        ["entry-p", "boat-deck-p", "entry-p"],
        ["entry-s", "boat-deck-s", "entry-s"],
        ["squok", "pool-hall", "squok"],
      ].sort()
    );
    expect(interior.links.filter((l) => l.kind !== "door")).toEqual([]);
  });

  it("reaches every walkable room and every lift car from a deck door, by seams, doors and lifts", () => {
    const seen = new Set<string>();
    for (const d of allLinks.filter((l) => l.kind === "door"))
      seen.add(d.to.area);
    const insideIds = new Set(inside.map((r) => r.id));
    let grew = true;
    while (grew) {
      grew = false;
      const join = (a: string, b: string) => {
        if (!insideIds.has(a) || !insideIds.has(b)) return;
        if (seen.has(a) !== seen.has(b)) {
          seen.add(a);
          seen.add(b);
          grew = true;
        }
      };
      for (const s of allSeams) join(s.a, s.b);
      for (const l of allLinks) join(l.from.area, l.to.area);
      // A shaft's cars: the ride joins every stop to every other.
      for (const l of interior.lifts ?? [])
        for (let i = 0; i + 1 < l.stops.length; i += 1)
          join(`${l.id}@${l.stops[i].deck}`, `${l.id}@${l.stops[i + 1].deck}`);
    }
    expect([...seen].sort()).toEqual(
      inside
        .filter((r) => !r.noWalk)
        .map((r) => r.id)
        .sort()
    );
  });

  it("stands every link end inside its area, 0.3 m clear of blockers and walls", () => {
    for (const l of allLinks)
      for (const end of [l.from, l.to]) {
        const area = map.areas.find((a) => a.id === end.area);
        expect([l.id, end.area, !!area]).toEqual([l.id, end.area, true]);
        if (!area) continue;
        expect([l.id, pointInPolygon(end.at, area.outline)]).toEqual([
          l.id,
          true,
        ]);
        expect([
          l.id,
          insideBlocker(map, end.area, end.at, WALK_RADIUS_M),
        ]).toEqual([l.id, false]);
        const room = byId.get(end.area);
        if (!room) continue;
        for (const [a, b] of edges(room.outline))
          if (!isSeamEdge(room.id, a, b))
            expect([
              l.id,
              end.area,
              segDist(end.at, a, b) >= WALK_RADIUS_M,
            ]).toEqual([l.id, end.area, true]);
      }
  });

  it("stands each deck door's outside end on her deck, within 0.5 m of the wall it is in", () => {
    for (const d of interior.links.filter((l) => l.kind === "door")) {
      const deck = CONCORDIA_WALK.areas.find((a) => a.id === d.from.area);
      expect([d.id, !!deck]).toEqual([d.id, true]);
      if (!deck) continue;
      expect([d.id, pointInPolygon(d.from.at, deck.outline)]).toEqual([
        d.id,
        true,
      ]);
      let face = Infinity;
      deck.wallEdges?.forEach((i) => {
        const a = deck.outline[i];
        const b = deck.outline[(i + 1) % deck.outline.length];
        face = Math.min(face, segDist(d.from.at, a, b));
      });
      expect([d.id, face <= 0.5, face >= WALK_RADIUS_M]).toEqual([
        d.id,
        true,
        true,
      ]);
      expect([
        d.id,
        insideBlocker(CONCORDIA_WALK, deck.id, d.from.at, WALK_RADIUS_M),
      ]).toEqual([d.id, false]);
      // The inside end is the room on the same deck.
      expect(byId.get(d.to.area)!.deck).toBe(deck.deck);
    }
  });

  it("keeps at least 2.1 m over every walkable point (its own ceiling and any room above)", () => {
    const SLAB_M = 0.2;
    for (const r of walkable) {
      const b = box(r.outline);
      for (let x = b.x0 + 0.125; x < b.x1; x += 0.25)
        for (let y = b.y0 + 0.125; y < b.y1; y += 0.25) {
          if (!pointInPolygon([x, y], r.outline)) continue;
          const f = roomFloorZ(r, x, y, spec);
          let clear = ceilingZ(r, x, y) - f;
          for (const o of allRooms) {
            if (o === r || !pointInPolygon([x, y], o.outline)) continue;
            const of = roomFloorZ(o, x, y, spec);
            if (of > f) clear = Math.min(clear, of - SLAB_M - f);
          }
          if (clear < 2.1)
            throw new Error(`${r.id} at ${x}, ${y}: ${clear.toFixed(2)} m`);
        }
    }
  });

  it("opens the atrium three storeys: no walkable floor over its well on decks 4 and 5, its roof the glass at deck 6 + 1", () => {
    const well = byId.get("atrium-well")!;
    expect(well.deck).toBe("3");
    expect(roomFloorZ(well, 70, 0, spec) + well.ceilingM).toBeCloseTo(
      Z("6") + 1,
      6
    );
    const b = box(well.outline);
    let probed = 0;
    for (let x = b.x0 + 0.25; x < b.x1; x += 0.5)
      for (let y = b.y0 + 0.25; y < b.y1; y += 0.5) {
        if (!pointInPolygon([x, y], well.outline)) continue;
        probed += 1;
        for (const a of map.areas) {
          if (a.noWalk || (a.deck !== "4" && a.deck !== "5")) continue;
          expect([a.id, x, y, pointInPolygon([x, y], a.outline)]).toEqual([
            a.id,
            x,
            y,
            false,
          ]);
        }
      }
    expect(probed).toBeGreaterThan(300);
    // The galleries ring it on decks 4 and 5, the stair runs down from 4.
    for (const id of ["atrium-4", "atrium-4-fwd", "atrium-5", "atrium-5-fwd"])
      expect(byId.get(id)!.kind).toBe("gallery");
    const stair = byId.get("atrium-stair")!;
    expect(stair.ramp?.dropM).toBeCloseTo(Z("4") - Z("3"), 6);
  });

  it("keeps the theatre's two aisles 1.1 m clear past every seat row, the rows on its rake", () => {
    const theatre = ["theatre-back", "theatre", "theatre-balcony"];
    const rows = interior.furniture.filter(
      (f) => f.piece === "theatre-seat-row"
    );
    expect(rows.length).toBeGreaterThanOrEqual(24);
    for (const f of rows) {
      expect([f.room, theatre.includes(f.room)]).toEqual([f.room, true]);
      expect(f.blocks).toBe(true);
      // Facing the stage (+x), square to her.
      expect(f.yaw).toBe(0);
      expect(byId.get(f.room)!.ramp).toBeDefined();
    }
    for (const id of theatre) {
      const r = byId.get(id)!;
      const b = box(r.outline);
      for (const side of [1, -1])
        for (let x = b.x0; x <= b.x1; x += 0.1)
          for (const off of [-0.55, -0.275, 0, 0.275, 0.55]) {
            const p: V2 = [x, side * 3.5 + off];
            expect([id, p, insideBlocker(map, id, p, 0)]).toEqual([
              id,
              p,
              false,
            ]);
          }
    }
    // A row's footprint is its seats'.
    const side = rows.find((f) => f.seats !== undefined)!;
    expect(pieceBlocker(side)).toEqual({
      kind: "box",
      area: side.room,
      min: [
        side.at[0] - seatRowFootprint(side.seats!).lx / 2,
        side.at[1] - seatRowFootprint(side.seats!).ly / 2,
      ],
      max: [
        side.at[0] + seatRowFootprint(side.seats!).lx / 2,
        side.at[1] + seatRowFootprint(side.seats!).ly / 2,
      ],
    });
    // The stage is a step up from the stalls' front, with steps at its sides.
    const stage = byId.get("stage")!;
    expect(roomFloorZ(stage, 104, 0, spec) - Z("3")).toBeCloseTo(1.0, 6);
  });

  it("stands shut doors on walls (not doorways), facing into their rooms", () => {
    expect(
      interior.shutDoors.filter((d) => d.room === "corridor-1").length
    ).toBeGreaterThanOrEqual(10);
    for (const d of interior.shutDoors) {
      const r = byId.get(d.room)!;
      const wall = edges(r.outline).find(
        ([a, b]) => !isSeamEdge(r.id, a, b) && segDist(d.at, a, b) < 0.01
      );
      expect([d.room, d.at, !!wall]).toEqual([d.room, d.at, true]);
      if (!wall) continue;
      const [a, b] = wall;
      const inward = Math.atan2(b[0] - a[0], -(b[1] - a[1]));
      const diff = Math.atan2(
        Math.sin(d.facing - inward),
        Math.cos(d.facing - inward)
      );
      expect([d.room, d.at, Math.abs(diff) < 1e-6]).toEqual([
        d.room,
        d.at,
        true,
      ]);
      for (const [p, q] of seamsOf(r.id))
        expect([d.room, d.at, segDist(d.at, p, q) >= 0.8]).toEqual([
          d.room,
          d.at,
          true,
        ]);
    }
  });

  it("puts furniture in its room, blocking pieces square, every doorway's middle clear", () => {
    for (const f of interior.furniture) {
      const r = byId.get(f.room)!;
      // A wall piece (an exit sign, a TV) stands at a wall's foot.
      const onWall =
        (MODERN_PIECE_MOUNT as Partial<Record<string, string>>)[f.piece] ===
          "wall" &&
        Math.min(...edges(r.outline).map(([a, b]) => segDist(f.at, a, b))) <=
          0.1 + 1e-9;
      expect([
        f.room,
        f.piece,
        onWall || pointInPolygon(f.at, r.outline),
      ]).toEqual([f.room, f.piece, true]);
      if (!f.blocks) continue;
      const quarter = f.yaw / (Math.PI / 2);
      expect(Math.abs(quarter - Math.round(quarter))).toBeLessThan(1e-9);
      // Its whole box in its room.
      const bl = pieceBlocker(f)!;
      if (bl.kind !== "box") continue;
      for (const c of [
        bl.min,
        bl.max,
        [bl.min[0], bl.max[1]] as V2,
        [bl.max[0], bl.min[1]] as V2,
      ])
        expect([f.room, f.piece, c, pointInPolygon(c, r.outline)]).toEqual([
          f.room,
          f.piece,
          c,
          true,
        ]);
    }
    for (const s of allSeams) {
      const mid: V2 = [
        (s.at[0][0] + s.at[1][0]) / 2,
        (s.at[0][1] + s.at[1][1]) / 2,
      ];
      for (const id of [s.a, s.b])
        expect([id, mid, insideBlocker(map, id, mid, 0.6)]).toEqual([
          id,
          mid,
          false,
        ]);
    }
  });

  it("dresses the rooms: beds, a sofa, a desk and TV; the bar; the club's pirate ship and castle", () => {
    const pieces = (room: string) =>
      interior.furniture.filter((f) => f.room === room).map((f) => f.piece);
    expect(pieces("stateroom")).toEqual(
      expect.arrayContaining(["cabin-bed", "cabin-sofa", "desk", "tv"])
    );
    expect(pieces("balcony").filter((p) => p === "balcony-chair")).toHaveLength(
      2
    );
    expect(
      pieces("cabin-inside").filter((p) => p === "cabin-bed")
    ).toHaveLength(2);
    expect(pieces("cabin-ocean")).toEqual(
      expect.arrayContaining(["cabin-bed", "cabin-sofa"])
    );
    expect(pieces("atrium-3")).toEqual(
      expect.arrayContaining(["bar-counter", "bar-stool"])
    );
    expect(pieces("squok")).toEqual(
      expect.arrayContaining([
        "pirate-ship",
        "castle-tower",
        "beanbag",
        "kids-table",
        "toy-shelf",
        "soft-play",
      ])
    );
    expect(pieces("stage")).toEqual(
      expect.arrayContaining(["stage-curtain", "stage-lights"])
    );
    // Every room has a finish and a floor, and her deck 1 rooms carpet.
    for (const r of interior.rooms) {
      expect(r.look.finish).toBeDefined();
      expect(r.look.floor).toBeDefined();
    }
  });
});

describe("the way through the stateroom to its balcony", () => {
  const blocks: { min: V2; max: V2 }[] = [];
  for (const f of interior.furniture) {
    const b = f.room === "stateroom" ? pieceBlocker(f) : null;
    if (b && b.kind === "box") blocks.push(b);
  }

  it("is never a pinch: blocking pieces that share a y band stand 0.9 m apart or more", () => {
    for (let i = 0; i < blocks.length; i += 1)
      for (let j = i + 1; j < blocks.length; j += 1) {
        const a = blocks[i];
        const b = blocks[j];
        const yOverlap =
          Math.min(a.max[1], b.max[1]) - Math.max(a.min[1], b.min[1]);
        if (yOverlap <= 0) continue;
        const xGap = Math.max(a.min[0] - b.max[0], b.min[0] - a.max[0]);
        expect([i, j, xGap >= 0.9 || xGap < 0]).toEqual([i, j, true]);
      }
  });

  it("is walked by a bot from the corridor door to the balcony and back", () => {
    const c = ctx({ interiorsOpen: true });
    /** Walks to each point in turn (steering by setting the yaw). */
    function botTo(start: WalkerState, route: V2[]): WalkerState {
      let s = start;
      for (const [tx, ty] of route) {
        let steps = 0;
        while (Math.hypot(tx - s.x, ty - s.y) > 0.12) {
          expect(steps++).toBeLessThan(600);
          const yaw = Math.atan2(ty - s.y, tx - s.x);
          s = stepWalker(
            { ...s, yaw },
            { ...STILL, forward: 1 },
            c,
            WALK_DT
          ).state;
        }
      }
      return s;
    }
    const door: V2 = [50.4, -9.0];
    const there: V2[] = [
      [50.4, -9.8],
      [50.0, -11],
      [50.0, -14.2],
      [49.4, -15.3],
      [49.4, -17.0],
    ];
    const start: WalkerState = {
      part: "whole",
      area: "corridor-7",
      x: door[0],
      y: door[1],
      yaw: -Math.PI / 2,
    };
    const out = botTo(start, there);
    expect(out.area).toBe("balcony");
    const back = botTo(
      out,
      [...there]
        .reverse()
        .slice(1)
        .concat([[50.4, -9.8]])
    );
    expect(back.area).toBe("stateroom");
    expect(back.y).toBeGreaterThan(-10.5);
  });
});

describe("her room entries (the camera picker's buttons)", () => {
  const entries = interior.entries ?? [];
  const frame = toSea.night.frames[0] as unknown as SimFrame;
  /** What each entry faces. */
  const TARGET: Record<string, V2> = {
    // The lifts' doors on the atrium's after wall.
    atrium: [64.2, 0],
    // The glass door out to the balcony.
    stateroom: [49.4, -15.95],
    // Down the corridor (its door in the lobby's after wall).
    "low-cabin": [56, -9.9],
    // The stage.
    theatre: [104, 0],
    // The pirate ship.
    squok: [46, 4],
  };

  it("are the five rooms in the spec, in order", () => {
    expect(entries.map((e) => [e.id, e.room])).toEqual([
      ["atrium", "atrium-well"],
      ["stateroom", "stateroom"],
      ["low-cabin", "lobby-1"],
      ["theatre", "theatre"],
      ["squok", "squok"],
    ]);
    for (const e of entries) {
      expect(e.label.length).toBeGreaterThan(2);
      expect(["staircase", "bed", "bunk", "corridor"]).toContain(e.icon);
    }
  });

  it("stand each spot inside its room, clear of the walls and furniture, facing what it names", () => {
    for (const e of entries) {
      const room = byId.get(e.room)!;
      expect([e.id, pointInPolygon(e.at, room.outline)]).toEqual([e.id, true]);
      for (const [a, b] of edges(room.outline))
        expect([e.id, segDist(e.at, a, b) > WALK_RADIUS_M]).toEqual([
          e.id,
          true,
        ]);
      expect([e.id, insideBlocker(map, e.room, e.at, WALK_RADIUS_M)]).toEqual([
        e.id,
        false,
      ]);
      const [tx, ty] = TARGET[e.id];
      const bearing = Math.atan2(ty - e.at[1], tx - e.at[0]);
      const off = Math.atan2(
        Math.sin(bearing - e.yaw),
        Math.cos(bearing - e.yaw)
      );
      expect([e.id, Math.abs(off) < Math.PI / 2]).toEqual([e.id, true]);
    }
  });

  it("are all open at the start of the night (dry, lit, before she lists)", () => {
    expect(Math.abs(frame.listDeg)).toBeLessThan(2);
    const open = openEntries(interior, {
      map,
      spec,
      frame,
      target: roomWaterTargets(spec),
    });
    expect(open.map((e) => e.id)).toEqual(entries.map((e) => e.id));
  });

  const ctx = (listDeg: number, target = roomWaterTargets(spec)) => ({
    map,
    spec,
    frame: { ...frame, listDeg } as SimFrame,
    target,
  });

  it("are hidden once she leans to 30° (closed), either way, and shown just under", () => {
    expect(interior.closeAtHeelDeg).toBe(30);
    for (const sign of [1, -1]) {
      expect(openEntries(interior, ctx(sign * 29.9)).length).toBe(
        entries.length
      );
      expect(openEntries(interior, ctx(sign * 30))).toEqual([]);
      expect(openEntries(interior, ctx(sign * 36))).toEqual([]);
    }
  });

  it("hides a room that is flooded deeper than wading, and only that one", () => {
    const flooded = (room: Room) => (room.id === "lobby-1" ? 20 : -Infinity);
    const ids = openEntries(interior, ctx(0, flooded)).map((e) => e.id);
    expect(ids).toEqual(
      entries.filter((e) => e.room !== "lobby-1").map((e) => e.id)
    );
    expect(ids).not.toContain("low-cabin");
  });
});

describe("the Titanic's interior is unchanged", () => {
  const hash = (v: unknown) =>
    createHash("sha256").update(JSON.stringify(v)).digest("hex");
  it("has the same data and merged map as before her rooms (1.17)", () => {
    expect(hash(TITANIC_INTERIOR)).toBe(
      "f3ec024b36f23e3a6eed80cd3529b833d0e42ddcac1fa4ad62777c790a57c31b"
    );
    expect(hash(walkMapFor("titanic"))).toBe(
      "1c3b8d1b22b3ffba52bf09391e497257a843f5301ad165d35658c1a19a4ad01c"
    );
  });
});
