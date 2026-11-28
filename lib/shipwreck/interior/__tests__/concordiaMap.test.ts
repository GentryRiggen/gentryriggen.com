import { concordia, CONCORDIA_BOATS } from "../../ships/concordia";
import {
  CONCORDIA_HALL_POOL,
  CONCORDIA_POOL_GLASS,
} from "../../ships/concordiaLayout";
import type { BodyPose } from "../../sim/track";
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
  type WalkInput,
  type WalkMap,
  type WalkerState,
} from "../../walk";
import { CONCORDIA_INTERIOR, POOL_HALL_EAVES_M } from "../concordia";
import {
  PIECE_FOOTPRINT,
  pieceBlocker,
  pieceFootprint,
  signedArea,
} from "../kit";
import { deckRoomWalk, withInterior } from "../merge";
import { POOL_BASIN_LX, POOL_BASIN_LY } from "../modernPieces";
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
  it("is hers, from the registry, with the pool hall only", () => {
    expect(interiorFor("concordia")).toBe(interior);
    expect(interior.ship).toBe("concordia");
    expect(interior.rooms.map((r) => r.id)).toEqual(["pool-hall"]);
    expect(hall.deckRoom).toBe(true);
    expect(hall.kind).toBe("pool-hall");
    expect(hall.look.finish).toBe("glass");
    expect(hall.look.floor).toBe("tile");
    expect(interior.seams).toEqual([]);
    expect(interior.links).toEqual([]);
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
    expect(map.areas).toHaveLength(CONCORDIA_WALK.areas.length);
    expect(map.blockers).toHaveLength(CONCORDIA_WALK.blockers.length);
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
