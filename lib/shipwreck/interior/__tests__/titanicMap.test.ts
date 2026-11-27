import { titanic } from "../../ships/titanic";
import { buildHull, hullHalfBreadth } from "../../sim/geometry";
import {
  floorZ,
  insideBlocker,
  pointInPolygon,
  TITANIC_WALK,
  walkMapFor,
  WALK_RADIUS_M,
  type V2,
  type WalkMap,
} from "../../walk";
import { DOOR_MIN_M, signedArea } from "../kit";
import { withInterior } from "../merge";
import { TITANIC_INTERIOR } from "../titanic";
import { floodsFromSea, roomFloorZ } from "../water";
import { interiorFor } from "..";
import type { Room } from "../types";

/**
 * The interior holds together: the maps.test.ts of the inside. Every room
 * is a clean outline, every doorway is a real shared edge at one floor
 * height, every room is reachable from a deck door, and nothing inside
 * puts a ceiling in your face.
 */

const spec = titanic;
const interior = TITANIC_INTERIOR;
const map = walkMapFor("titanic") as WalkMap;
const rooms = interior.rooms;
const roomById = new Map(rooms.map((r) => [r.id, r]));
const walkable = rooms.filter((r) => !r.noWalk);

/** Pieces hung on a wall (their `at` is the wall's foot). */
const WALL_PIECES: ReadonlySet<string> = new Set([
  "sconce",
  "porthole",
  "pipes",
  "fire-buckets",
  "hose-reel",
  "clock-panel",
]);

const TOL = 1e-3;
const near = (p: V2, q: V2) =>
  Math.abs(p[0] - q[0]) <= TOL && Math.abs(p[1] - q[1]) <= TOL;

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
  // Touching or overlapping counts too (non-adjacent edges never meet).
  return (
    segDist(a, c, d) < 1e-9 ||
    segDist(b, c, d) < 1e-9 ||
    segDist(c, a, b) < 1e-9 ||
    segDist(d, a, b) < 1e-9
  );
}

/** Whether a seam segment is exactly one edge of a room's outline. */
function seamEdgeIndex(room: Room, at: readonly [V2, V2]): number {
  const [p, q] = at;
  return edges(room.outline).findIndex(
    ([a, b]) => (near(a, p) && near(b, q)) || (near(a, q) && near(b, p))
  );
}

/** The seam segments touching a room. */
function seamsOf(id: string): (readonly [V2, V2])[] {
  return interior.seams
    .filter((s) => s.a === id || s.b === id)
    .map((s) => s.at);
}

function isSeamEdge(id: string, a: V2, b: V2): boolean {
  return seamsOf(id).some(
    ([p, q]) => (near(a, p) && near(b, q)) || (near(a, q) && near(b, p))
  );
}

/** Ship-frame z of a room's ceiling over (x, y). */
function ceilingZ(room: Room, x: number): number {
  // A flight's ceiling is over its higher end (the floor before its drop).
  return roomFloorZ({ ...room, ramp: undefined }, x, 0, spec) + room.ceilingM;
}

describe("the Titanic's interior", () => {
  it("is hers, and nobody else has one", () => {
    expect(interior.ship).toBe("titanic");
    expect(interiorFor("titanic")).toBe(TITANIC_INTERIOR);
    expect(interiorFor("lusitania")).toBeNull();
    expect(interiorFor("britannic")).toBeNull();
  });

  it("has the rooms in the spec", () => {
    const ids = rooms.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const want of [
      "gs-boat",
      "gs-a",
      "gs-b",
      "gs-c",
      "b-corridor",
      "suite-1",
      "suite-2",
      "suite-3",
      "lift-b",
      "lift-e",
      "scotland-road",
      "third-cabin",
    ])
      expect(ids).toContain(want);
    expect(ids.some((id) => id.startsWith("third-stairs"))).toBe(true);
    expect(roomById.get("gs-c")?.noWalk).toBe(true);
  });

  it("lays every room on one of her decks, its outline counter-clockwise and simple", () => {
    const decks = spec.decks.map((d) => d.name);
    for (const r of rooms) {
      expect([r.id, decks.includes(r.deck)]).toEqual([r.id, true]);
      expect(r.outline.length).toBeGreaterThanOrEqual(3);
      expect([r.id, signedArea(r.outline) > 0]).toEqual([r.id, true]);
      const es = edges(r.outline);
      for (const [a, b] of es)
        expect([r.id, Math.hypot(b[0] - a[0], b[1] - a[1]) > 0.05]).toEqual([
          r.id,
          true,
        ]);
      for (let i = 0; i < es.length; i += 1)
        for (let j = i + 2; j < es.length; j += 1) {
          if (i === 0 && j === es.length - 1) continue; // adjacent
          expect([r.id, i, j, segmentsCross(...es[i], ...es[j])]).toEqual([
            r.id,
            i,
            j,
            false,
          ]);
        }
      expect(r.ceilingM).toBeGreaterThan(0);
    }
  });

  it("keeps every room inside her hull (C deck and below) and her beam", () => {
    const hull = buildHull(spec);
    for (const r of rooms)
      for (const [x, y] of r.outline) {
        expect([r.id, Math.abs(y) <= spec.beam / 2 - 0.3]).toEqual([
          r.id,
          true,
        ]);
        if (!["C", "D", "E"].includes(r.deck)) continue;
        // Just under the floor, or the hull's top edge (the C deck) for a
        // floor above it.
        const z = Math.min(roomFloorZ(r, x, y, spec), spec.sheerZ(x)) - 0.3;
        expect([
          r.id,
          x,
          y,
          Math.abs(y) < hullHalfBreadth(hull, x, z) - 0.3,
        ]).toEqual([r.id, x, y, true]);
      }
  });

  it("makes every seam an edge of both rooms, at least a doorway wide, with the floors level across it", () => {
    expect(interior.seams.length).toBeGreaterThan(0);
    for (const s of interior.seams) {
      const a = roomById.get(s.a);
      const b = roomById.get(s.b);
      expect([s.a, s.b, !!a, !!b]).toEqual([s.a, s.b, true, true]);
      if (!a || !b) continue;
      expect([s.a, s.b, a.noWalk ?? false, b.noWalk ?? false]).toEqual([
        s.a,
        s.b,
        false,
        false,
      ]);
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
    // A seam matching no edge is silently ignored by the walker: hold the
    // merged map to it too.
    for (const s of interior.seams) {
      for (const [self, other] of [
        [s.a, s.b],
        [s.b, s.a],
      ]) {
        const area = map.areas.find((x) => x.id === self);
        expect(area).toBeDefined();
        const hit = edges(area!.outline).some(
          ([a, b]) =>
            (near(a, s.at[0]) && near(b, s.at[1])) ||
            (near(a, s.at[1]) && near(b, s.at[0]))
        );
        expect([self, other, hit]).toEqual([self, other, true]);
      }
    }
  });

  it("leaves no reflex corner sharper than a chamfer's except at a seam's end", () => {
    // A chamfered right-angle corner turns 45° at each of its two ends.
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

  it("reaches every walkable room from a deck door, by seams and links", () => {
    const doors = interior.links.filter((l) => l.kind === "door");
    expect(doors.length).toBe(3);
    const seen = new Set<string>();
    for (const d of doors)
      for (const end of [d.from, d.to])
        if (roomById.has(end.area)) seen.add(end.area);
    let grew = true;
    while (grew) {
      grew = false;
      const join = (a: string, b: string) => {
        if (seen.has(a) !== seen.has(b)) {
          seen.add(a);
          seen.add(b);
          grew = true;
        }
      };
      for (const s of interior.seams) join(s.a, s.b);
      for (const l of interior.links)
        if (roomById.has(l.from.area) && roomById.has(l.to.area))
          join(l.from.area, l.to.area);
    }
    expect([...seen].sort()).toEqual(walkable.map((r) => r.id).sort());
    for (const r of rooms.filter((x) => x.noWalk))
      expect(seen.has(r.id)).toBe(false);
  });

  it("has three deck doors (the staircase's two and third class) and the lift", () => {
    const doors = interior.links.filter((l) => l.kind === "door");
    const ins = doors.map((d) => d.to.area).sort();
    expect(ins.filter((a) => a === "gs-boat")).toHaveLength(2);
    expect(ins.some((a) => a.startsWith("third-stairs"))).toBe(true);
    const lifts = interior.links.filter((l) => l.kind === "lift");
    expect(lifts).toHaveLength(1);
    expect([lifts[0].from.area, lifts[0].to.area].sort()).toEqual([
      "lift-b",
      "lift-e",
    ]);
  });

  it("stands every link end inside its area, 0.3 m clear of blockers and walls", () => {
    for (const l of interior.links)
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
        const room = roomById.get(end.area);
        if (!room) continue;
        for (const [a, b] of edges(room.outline))
          if (!isSeamEdge(room.id, a, b))
            expect([l.id, segDist(end.at, a, b) >= WALK_RADIUS_M]).toEqual([
              l.id,
              true,
            ]);
      }
  });

  it("stands each deck door's outside end on the open deck, within 0.5 m of the house face", () => {
    for (const d of interior.links.filter((l) => l.kind === "door")) {
      const deck = TITANIC_WALK.areas.find((a) => a.id === d.from.area);
      expect([d.id, !!deck]).toEqual([d.id, true]);
      if (!deck) continue;
      expect(pointInPolygon(d.from.at, deck.outline)).toBe(true);
      // The face: a house (a box blocker) or the deck's own end wall.
      let face = Infinity;
      for (const b of TITANIC_WALK.blockers)
        if (b.kind === "box" && b.area === deck.id) {
          const cx = Math.max(b.min[0], Math.min(b.max[0], d.from.at[0]));
          const cy = Math.max(b.min[1], Math.min(b.max[1], d.from.at[1]));
          face = Math.min(
            face,
            Math.hypot(d.from.at[0] - cx, d.from.at[1] - cy)
          );
        }
      deck.wallEdges?.forEach((i) => {
        const a = deck.outline[i];
        const b = deck.outline[(i + 1) % deck.outline.length];
        face = Math.min(face, segDist(d.from.at, a, b));
      });
      expect([d.id, face <= 0.5]).toEqual([d.id, true]);
      expect(face).toBeGreaterThanOrEqual(WALK_RADIUS_M);
    }
  });

  it("keeps at least 2.1 m over every walkable point (its own ceiling and any room above)", () => {
    const SLAB_M = 0.2;
    for (const r of walkable) {
      const xs = r.outline.map((p) => p[0]);
      const ys = r.outline.map((p) => p[1]);
      for (let x = Math.min(...xs) + 0.125; x < Math.max(...xs); x += 0.25)
        for (let y = Math.min(...ys) + 0.125; y < Math.max(...ys); y += 0.25) {
          if (!pointInPolygon([x, y], r.outline)) continue;
          const f = roomFloorZ(r, x, y, spec);
          let clear = ceilingZ(r, x) - f;
          for (const o of rooms) {
            if (o === r || !pointInPolygon([x, y], o.outline)) continue;
            const of = roomFloorZ(o, x, y, spec);
            if (of > f) clear = Math.min(clear, of - SLAB_M - f);
          }
          if (clear < 2.1)
            throw new Error(`${r.id} at ${x}, ${y}: ${clear.toFixed(2)} m`);
        }
    }
  });

  it("puts every compartment-water room inside one compartment", () => {
    for (const r of rooms.filter((x) => x.water === "compartment")) {
      const xs = r.outline.map((p) => p[0]);
      const inOne = spec.compartments.some(
        (c) => c.fromX <= Math.min(...xs) && Math.max(...xs) <= c.toX
      );
      expect([r.id, inOne]).toEqual([r.id, true]);
    }
  });

  it("floods every room from the sea (all are at or above the bulkhead tops)", () => {
    for (const r of rooms) {
      expect([r.id, floodsFromSea(r, spec)]).toEqual([r.id, true]);
      expect(r.water).not.toBe("compartment");
    }
  });

  it("runs Scotland Road down E deck, port side, from forward of x 69 to bulkhead J", () => {
    const sr = roomById.get("scotland-road")!;
    expect(sr.deck).toBe("E");
    expect(sr.kind).toBe("corridor");
    const xs = sr.outline.map((p) => p[0]);
    expect(Math.max(...xs)).toBeGreaterThanOrEqual(69);
    expect(Math.min(...xs)).toBeLessThanOrEqual(-15);
    for (const [, y] of sr.outline) expect(y).toBeGreaterThan(0);
    expect(sr.axis).toBeDefined();
  });

  it("stands shut doors on walls (not doorways), facing into their rooms", () => {
    expect(interior.shutDoors.length).toBeGreaterThan(20);
    for (const d of interior.shutDoors) {
      const r = roomById.get(d.room);
      expect([d.room, !!r]).toEqual([d.room, true]);
      if (!r) continue;
      const wall = edges(r.outline).find(
        ([a, b]) => !isSeamEdge(r.id, a, b) && segDist(d.at, a, b) < 0.01
      );
      expect([d.room, d.at, !!wall]).toEqual([d.room, d.at, true]);
      if (!wall) continue;
      const [a, b] = wall;
      // Inward normal of a counter-clockwise edge: its left.
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

  it("puts furniture in its room, blocking pieces square and clear of doorways and link ends", () => {
    for (const f of interior.furniture) {
      const r = roomById.get(f.room);
      expect([f.room, f.piece, !!r]).toEqual([f.room, f.piece, true]);
      if (!r) continue;
      expect([f.room, f.piece, f.at, pointInPolygon(f.at, r.outline)]).toEqual([
        f.room,
        f.piece,
        f.at,
        true,
      ]);
      if (!f.blocks) continue;
      const quarter = f.yaw / (Math.PI / 2);
      expect(Math.abs(quarter - Math.round(quarter))).toBeLessThan(1e-9);
    }
    // Every doorway's middle has room for the walker and a little more.
    for (const s of interior.seams) {
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

  it("leaves every doorway and corridor passable round the furniture (a BFS with the body's radius)", () => {
    // Per walkable room, a 0.1 m grid of the spots the walker's body fits
    // (inside, WALK_RADIUS_M clear of every wall edge and every blocker);
    // every doorway's mouth, link end and corridor end must be one
    // connected patch, and every blocking piece must be reachable (you can
    // walk up to the bed).
    const STEP = 0.1;
    const R = WALK_RADIUS_M;
    for (const room of walkable) {
      const walls = edges(room.outline).filter(
        ([a, b]) => !isSeamEdge(room.id, a, b)
      );
      const xs = room.outline.map((p) => p[0]);
      const ys = room.outline.map((p) => p[1]);
      const x0 = Math.min(...xs);
      const y0 = Math.min(...ys);
      const nx = Math.ceil((Math.max(...xs) - x0) / STEP) + 1;
      const ny = Math.ceil((Math.max(...ys) - y0) / STEP) + 1;
      const at = (i: number, j: number): V2 => [x0 + i * STEP, y0 + j * STEP];
      const free = new Uint8Array(nx * ny);
      for (let i = 0; i < nx; i += 1)
        for (let j = 0; j < ny; j += 1) {
          const p = at(i, j);
          if (!pointInPolygon(p, room.outline)) continue;
          if (walls.some(([a, b]) => segDist(p, a, b) < R)) continue;
          if (insideBlocker(map, room.id, p, R)) continue;
          free[i * ny + j] = 1;
        }
      /** The free cell nearest p (within 0.2 m), or -1. */
      const cellNear = (p: V2): number => {
        let best = -1;
        let bestD = 0.2;
        const ci = Math.round((p[0] - x0) / STEP);
        const cj = Math.round((p[1] - y0) / STEP);
        for (let i = ci - 2; i <= ci + 2; i += 1)
          for (let j = cj - 2; j <= cj + 2; j += 1) {
            if (i < 0 || j < 0 || i >= nx || j >= ny || !free[i * ny + j])
              continue;
            const q = at(i, j);
            const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
            if (d <= bestD) {
              bestD = d;
              best = i * ny + j;
            }
          }
        return best;
      };
      // Where the walker must get to: 0.4 m in from each doorway's middle,
      // each link end, each end of a corridor's axis.
      const targets: [string, V2][] = [];
      for (const s of interior.seams) {
        if (s.a !== room.id && s.b !== room.id) continue;
        const k = seamEdgeIndex(room, s.at);
        const a = room.outline[k];
        const b = room.outline[(k + 1) % room.outline.length];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        targets.push([
          `doorway to ${s.a === room.id ? s.b : s.a}`,
          [
            (a[0] + b[0]) / 2 - ((b[1] - a[1]) / len) * 0.4,
            (a[1] + b[1]) / 2 + ((b[0] - a[0]) / len) * 0.4,
          ],
        ]);
      }
      for (const l of interior.links)
        for (const end of [l.from, l.to])
          if (end.area === room.id) targets.push([`link ${l.id}`, end.at]);
      if (room.axis && !room.ramp) {
        const [p, q] = room.axis;
        const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
        const ux = (q[0] - p[0]) / len;
        const uy = (q[1] - p[1]) / len;
        targets.push(["axis start", [p[0] + ux * 0.4, p[1] + uy * 0.4]]);
        targets.push(["axis end", [q[0] - ux * 0.4, q[1] - uy * 0.4]]);
      }
      expect([room.id, targets.length > 0]).toEqual([room.id, true]);
      const cells = targets.map(([name, p]) => [name, cellNear(p)] as const);
      for (const [name, c] of cells)
        expect([room.id, name, c >= 0]).toEqual([room.id, name, true]);
      // Flood from the first target.
      const reached = new Uint8Array(nx * ny);
      const queue = [cells[0][1]];
      reached[cells[0][1]] = 1;
      while (queue.length) {
        const c = queue.pop()!;
        const i = Math.floor(c / ny);
        const j = c % ny;
        for (const [di, dj] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const a = i + di;
          const b = j + dj;
          if (a < 0 || b < 0 || a >= nx || b >= ny) continue;
          const k = a * ny + b;
          if (!free[k] || reached[k]) continue;
          reached[k] = 1;
          queue.push(k);
        }
      }
      for (const [name, c] of cells)
        expect([room.id, name, reached[c] === 1]).toEqual([
          room.id,
          name,
          true,
        ]);
      // Every blocking piece can be walked up to (a reached spot within
      // 0.25 m of where the body touches it).
      for (const f of interior.furniture) {
        if (f.room !== room.id || !f.blocks) continue;
        const box = map.blockers.find(
          (b) =>
            b.kind === "box" &&
            b.area === room.id &&
            f.at[0] > b.min[0] &&
            f.at[0] < b.max[0] &&
            f.at[1] > b.min[1] &&
            f.at[1] < b.max[1]
        );
        expect([room.id, f.piece, !!box]).toEqual([room.id, f.piece, true]);
        if (!box || box.kind !== "box") continue;
        let near = false;
        for (let k = 0; k < reached.length && !near; k += 1) {
          if (!reached[k]) continue;
          const p = at(Math.floor(k / ny), k % ny);
          const dx = Math.max(box.min[0] - p[0], 0, p[0] - box.max[0]);
          const dy = Math.max(box.min[1] - p[1], 0, p[1] - box.max[1]);
          if (Math.hypot(dx, dy) < R + 0.25) near = true;
        }
        expect([room.id, f.piece, f.at, near]).toEqual([
          room.id,
          f.piece,
          f.at,
          true,
        ]);
      }
    }
  });

  it("dresses the suites, the third-class cabin and Scotland Road", () => {
    const pieces = (room: string) =>
      interior.furniture.filter((f) => f.room === room).map((f) => f.piece);
    expect(pieces("suite-1")).toEqual(
      expect.arrayContaining(["bed", "wardrobe", "porthole", "sconce"])
    );
    expect(pieces("suite-2").filter((p) => p === "single-bed")).toHaveLength(2);
    expect(pieces("suite-2")).toContain("washstand");
    expect(pieces("suite-3")).toEqual(
      expect.arrayContaining(["sofa", "table", "chair"])
    );
    // Two pairs of steel bunks, an enamel washbasin, a porthole.
    expect(pieces("third-cabin").filter((p) => p === "bunk")).toHaveLength(2);
    expect(pieces("third-cabin")).toEqual(
      expect.arrayContaining(["washbasin", "porthole", "caged-bulb"])
    );
    // Pipes, caged bulbs, fire buckets and hose reels down Scotland Road;
    // steel doors along both its walls.
    const sr = pieces("scotland-road");
    for (const p of ["pipes", "caged-bulb", "fire-buckets", "hose-reel"])
      expect([p, sr.includes(p as never)]).toEqual([p, true]);
    const steel = interior.shutDoors.filter(
      (d) => d.room === "scotland-road" && d.style === "steel"
    );
    expect(steel.length).toBeGreaterThan(30);
    // Wall pieces stand on a wall (within 0.1 m), not out in the room.
    for (const f of interior.furniture) {
      if (!WALL_PIECES.has(f.piece)) continue;
      const r = roomById.get(f.room)!;
      const d = Math.min(
        ...edges(r.outline)
          .filter(([a, b]) => !isSeamEdge(r.id, a, b))
          .map(([a, b]) => segDist(f.at, a, b))
      );
      expect([f.room, f.piece, f.at, d <= 0.1 + 1e-6]).toEqual([
        f.room,
        f.piece,
        f.at,
        true,
      ]);
    }
  });

  it("gives every room a zone and a look", () => {
    for (const r of rooms) {
      expect(r.zone.length).toBeGreaterThan(0);
      expect(r.look.finish).toBeDefined();
      expect(r.look.floor).toBeDefined();
    }
  });
});

describe("the merged walk map", () => {
  it("is the open decks plus the interior; the open decks are unchanged", () => {
    expect(walkMapFor("titanic")).toBe(map); // memoised
    expect(map).toEqual(withInterior(TITANIC_WALK, TITANIC_INTERIOR));
    expect(TITANIC_WALK.areas.map((a) => a.id)).toEqual([
      "boat-deck",
      "forward-well",
      "forecastle",
      "aft-well",
      "poop",
    ]);
    expect(TITANIC_WALK.seams).toBeUndefined();
    for (const a of TITANIC_WALK.areas) expect(map.areas).toContain(a);
    for (const b of TITANIC_WALK.blockers) expect(map.blockers).toContain(b);
    for (const s of TITANIC_WALK.stairs) expect(map.stairs).toContain(s);
    expect(map.areas).toHaveLength(TITANIC_WALK.areas.length + rooms.length);
    expect(map.seams).toEqual(TITANIC_INTERIOR.seams);
  });

  it("flags rooms as interior areas with their ramps, axes and kinds", () => {
    for (const r of rooms) {
      const a = map.areas.find((x) => x.id === r.id)!;
      expect(a.interior).toBe(true);
      expect(a.deck).toBe(r.deck);
      expect(a.outline).toEqual(r.outline);
      expect(a.kind).toBe(r.kind);
      expect(a.ramp).toEqual(r.ramp);
      expect(a.axis).toEqual(r.axis);
      expect(a.noWalk).toBe(r.noWalk ? true : undefined);
      // The room's floor is the walk map's floor.
      const [x, y] = r.outline[0];
      expect(roomFloorZ(r, x, y, spec)).toBeCloseTo(
        floorZ(map, r.id, x, spec, y),
        9
      );
    }
  });

  it("turns blocking furniture into blockers in its room, and links into stairs", () => {
    const blocking = TITANIC_INTERIOR.furniture.filter((f) => f.blocks);
    expect(blocking.length).toBeGreaterThan(5);
    expect(map.blockers).toHaveLength(
      TITANIC_WALK.blockers.length + blocking.length
    );
    for (const f of blocking)
      expect([f.room, insideBlocker(map, f.room, f.at, 0)]).toEqual([
        f.room,
        true,
      ]);
    for (const l of TITANIC_INTERIOR.links) expect(map.stairs).toContain(l);
  });

  it("keeps the spawn", () => {
    expect(map.spawn).toEqual(TITANIC_WALK.spawn);
    expect(map.spawn).toEqual({ area: "boat-deck", at: [10, -10], yaw: 0 });
  });
});
