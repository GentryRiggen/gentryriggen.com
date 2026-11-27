import { TITANIC_INTERIOR } from "../../interior/titanic";
import { titanic } from "../../ships/titanic";
import type { BodyPose } from "../../sim/track";
import { shipToEarth } from "../slope";
import {
  stepWalker,
  type StepContext,
  type StepResult,
  type WalkerState,
  type WalkInput,
} from "../step";
import {
  doorsOf,
  floorZ,
  insideBlocker,
  pointInPolygon,
  walkMapFor,
  WALK_INSIDE_EASE_S,
  WALK_INSIDE_SPEED_MS,
  WALK_RADIUS_M,
  WALK_WADE_STOP_M,
  type V2,
  type WalkArea,
  type WalkMap,
} from "..";

/**
 * The feel test (spec: "The joystick in narrow halls"): a bot holds the
 * stick and walks the real merged Titanic interior at a fixed 1/60 s.
 * Every corridor end to end with the view turned off its axis, every
 * doorway from 1 m either side at ±30°, every flight up and down, the
 * corners the kit could not chamfer probed at angles, a seeded random walk
 * per zone, and deep water as a wall.
 */

const spec = titanic;
const map = walkMapFor("titanic") as WalkMap;
const DT = 1 / 60;
const SPEED = WALK_INSIDE_SPEED_MS;
const DEG = Math.PI / 180;
const POSE: BodyPose = {
  part: "whole",
  x: 0,
  y: 0,
  z: -9.83,
  pitch: 0,
  roll: 0,
  yaw: 0,
};
const DRY = () => -1000;
const CTX: StepContext = { map, spec, pose: POSE, breakX: null, seaZ: DRY };

const byId = new Map(map.areas.map((a) => [a.id, a]));
const area = (id: string): WalkArea => {
  const a = byId.get(id);
  if (!a) throw new Error(`no area ${id}`);
  return a;
};
const rooms = map.areas.filter((a) => a.interior && !a.noWalk);
const seams = map.seams ?? [];
const FORWARD: WalkInput = { forward: 1, strafe: 0, lookDx: 0, lookDy: 0 };

const walker = (id: string, p: V2, yaw: number): WalkerState => ({
  part: "whole",
  area: id,
  x: p[0],
  y: p[1],
  yaw,
});

/** Where a point is in its own area's outline (the walker never leaves it). */
const inOwn = (s: WalkerState) =>
  pointInPolygon([s.x, s.y], area(s.area).outline);

const floorOf = (s: WalkerState) => floorZ(map, s.area, s.x, spec, s.y);

/**
 * Steps the walker at 1/60 s for up to `seconds`, checking every substep
 * that it is inside its own area's outline and its floor never jumps more
 * than 0.1 m. `each` returns true to stop early.
 */
function bot(
  start: WalkerState,
  input: WalkInput | ((t: number, s: WalkerState) => WalkInput),
  seconds: number,
  each?: (r: StepResult, t: number) => boolean | void,
  c: StepContext = CTX
): { r: StepResult; t: number; outside: number; worstFloor: number } {
  let r: StepResult = { state: start, inWater: null, depthM: 0, slopeDeg: 0 };
  let outside = 0;
  let worstFloor = 0;
  let z = floorOf(start);
  const steps = Math.round(seconds / DT);
  for (let i = 1; i <= steps; i += 1) {
    const t = i * DT;
    const inp = typeof input === "function" ? input(t, r.state) : input;
    r = stepWalker(r.state, inp, c, DT);
    if (!inOwn(r.state)) outside += 1;
    const z2 = floorOf(r.state);
    worstFloor = Math.max(worstFloor, Math.abs(z2 - z));
    z = z2;
    if (each?.(r, t)) return { r, t, outside, worstFloor };
    if (r.inWater) break;
  }
  return { r, t: seconds, outside, worstFloor };
}

const unit = (a: V2, b: V2): [number, number, number] => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  return [dx / len, dy / len, len];
};

/** The room across a seam that touches point p of room `id` (null: none). */
function roomAcross(id: string, p: V2): string | null {
  let best: string | null = null;
  let bestD = 0.05;
  for (const s of seams) {
    if (s.a !== id && s.b !== id) continue;
    const mx = (s.at[0][0] + s.at[1][0]) / 2;
    const my = (s.at[0][1] + s.at[1][1]) / 2;
    const d = Math.hypot(mx - p[0], my - p[1]);
    if (d < bestD) {
      bestD = d;
      best = s.a === id ? s.b : s.a;
    }
  }
  return best;
}

/** A hall's side doorways (from inside it) and the room each opens into. */
function sideDoors(id: string) {
  return doorsOf(map, id)
    .filter((d) => d.side)
    .map((d) => {
      const seam = seams.find(
        (s) =>
          (s.a === id || s.b === id) &&
          Math.abs((s.at[0][0] + s.at[1][0]) / 2 - d.cx) < 1e-6 &&
          Math.abs((s.at[0][1] + s.at[1][1]) / 2 - d.cy) < 1e-6
      );
      if (!seam) throw new Error(`no seam for a door of ${id}`);
      return { d, to: seam.a === id ? seam.b : seam.a };
    });
}

/**
 * Ruling (Gentry via the controller, 2026-11-27): a child aiming at a door
 * must get in. So a corridor walk at ±30° toward the wall with side doors
 * may end in the first of them (its line meets the opening once it scrapes
 * that wall); 0°, ±10° and ±20° must still walk the corridor end to end.
 */
describe("corridors end to end, view turned off the axis", () => {
  const corridors = rooms.filter(
    (a) => a.axis && (a.kind === "corridor" || a.kind === "passage")
  );
  it("covers the corridors", () => {
    expect(corridors.map((c) => c.id).sort()).toEqual([
      "b-corridor",
      "e-lobby",
      "scotland-road",
      "third-passage",
    ]);
  });

  for (const c of corridors) {
    for (const back of [false, true]) {
      for (const off of [0, 10, -10, 20, -20, 30, -30]) {
        it(`${c.id} ${back ? "back" : "forward"} at ${off}°`, () => {
          const [a0, a1] = c.axis!;
          const [a, b] = back ? [a1, a0] : [a0, a1];
          const [ux, uy, L] = unit(a, b);
          const start: V2 = [a[0] + ux * 0.4, a[1] + uy * 0.4];
          const yaw = Math.atan2(uy, ux) + off * DEG;
          const goal = L - 0.5;
          const limit = L / (0.8 * SPEED) + 1;
          const progress: number[] = [];
          let worstWindow = Infinity;
          const W = Math.round(0.5 / DT);
          const sideRooms = new Set(sideDoors(c.id).map((x) => x.to));
          let wentIn = false;
          const run = bot(
            { ...walker(c.id, start, yaw), moveShare: 0 },
            FORWARD,
            limit,
            (r) => {
              if (sideRooms.has(r.state.area)) {
                wentIn = true;
                return true;
              }
              const p = (r.state.x - a[0]) * ux + (r.state.y - a[1]) * uy;
              progress.push(p);
              const n = progress.length;
              if (n > W)
                worstWindow = Math.min(worstWindow, p - progress[n - 1 - W]);
              return p >= goal;
            }
          );
          if (wentIn && Math.abs(off) === 30) {
            // Allowed by the ruling: it went in by a side door, steadily.
            expect(run.outside).toBe(0);
            expect(run.r.state.yaw).toBe(yaw);
            return;
          }
          expect({
            arrived: progress[progress.length - 1] >= goal,
            yawKept: run.r.state.yaw,
            outside: run.outside,
          }).toEqual({ arrived: true, yawKept: yaw, outside: 0 });
          expect(run.t).toBeLessThanOrEqual(limit);
          expect(worstWindow).toBeGreaterThanOrEqual(0.5);
        });
      }
    }
  }
});

/**
 * The spec's door case: a child up the corridor turns to the door and
 * pushes. From 1 m and 1.5 m along the hall either side of each side
 * doorway, on the centre line, aimed at its centre plus an error (+ is
 * steeper at the door, − is toward the hall's axis). Every aim whose line
 * meets the opening goes through within 1.5 s. Aims within 15° of the hall
 * (1 m: −20°, −30°; 1.5 m: −10° and beyond) miss the opening and are walks
 * down the corridor: the hall assist and pass-by keep those in the hall.
 */
describe("side doorways from up the corridor, aimed at the door", () => {
  const halls = rooms.filter((a) => a.axis && sideDoors(a.id).length > 0);
  it("covers the B deck suites and the E deck lobby", () => {
    expect(halls.map((h) => h.id).sort()).toEqual([
      "b-corridor",
      "scotland-road",
    ]);
  });
  const GRID: readonly [dist: number, errs: readonly number[]][] = [
    [1, [-10, 0, 10, 20, 30]],
    [1.5, [0, 10, 20, 30]],
  ];
  for (const hall of halls) {
    for (const { d, to } of sideDoors(hall.id)) {
      it(`${hall.id} → ${to}`, () => {
        const [a0, a1] = hall.axis!;
        const [ux, uy] = unit(a0, a1);
        const u0 = (d.cx - a0[0]) * ux + (d.cy - a0[1]) * uy;
        const missed: string[] = [];
        let passed = 0;
        for (const [dist, errs] of GRID) {
          for (const side of [-1, 1]) {
            const p: V2 = [
              a0[0] + ux * (u0 + side * dist),
              a0[1] + uy * (u0 + side * dist),
            ];
            const bearing = Math.atan2(d.cy - p[1], d.cx - p[0]);
            // Which way is "steeper at the door" from this side.
            const back = Math.atan2(-side * uy, -side * ux);
            const steeper = Math.sign(
              Math.sin(bearing - back) // bearing turned off the axis
            );
            for (const err of [...errs, -30]) {
              const yaw = bearing + steeper * err * DEG;
              const run = bot(
                { ...walker(hall.id, p, yaw), moveShare: 0 },
                FORWARD,
                1.5,
                (r) => r.state.area === to
              );
              const inside = run.r.state.area === to;
              if (run.outside > 0)
                missed.push(`${dist} ${side} ${err} outside`);
              if (err === -30) {
                // Down the corridor, not at the door: it stays in the hall.
                if (inside) missed.push(`${dist} ${side} ${err} went in`);
              } else if (inside) passed += 1;
              else missed.push(`${dist} ${side} ${err} missed`);
            }
          }
        }
        expect(missed).toEqual([]);
        expect(passed).toBe(18);
      });
    }
  }
});

describe("doorways from 1 m straight out either side, aimed within ±30°", () => {
  const DOOR_KINDS = new Set(["corridor", "cabin"]);
  const doorways = seams.filter(
    (s) =>
      DOOR_KINDS.has(area(s.a).kind ?? "") ||
      DOOR_KINDS.has(area(s.b).kind ?? "")
  );
  it("covers the doorways", () => {
    expect(doorways.length).toBeGreaterThanOrEqual(7);
  });

  for (const s of doorways) {
    for (const [from, to] of [
      [s.a, s.b],
      [s.b, s.a],
    ] as const) {
      for (const aim of [0, 15, -15, 30, -30]) {
        it(`${from} → ${to} at ${aim}°`, () => {
          const c: V2 = [
            (s.at[0][0] + s.at[1][0]) / 2,
            (s.at[0][1] + s.at[1][1]) / 2,
          ];
          const [tx, ty] = unit(s.at[0], s.at[1]);
          // The normal pointing from `from` into `to`.
          let nx = -ty;
          let ny = tx;
          if (
            !pointInPolygon(
              [c[0] + nx * 0.05, c[1] + ny * 0.05],
              area(to).outline
            )
          ) {
            nx = -nx;
            ny = -ny;
          }
          const start: V2 = [c[0] - nx, c[1] - ny];
          expect(pointInPolygon(start, area(from).outline)).toBe(true);
          const yaw = Math.atan2(ny, nx) + aim * DEG;
          const run = bot(
            { ...walker(from, start, yaw), moveShare: 0 },
            FORWARD,
            1.5,
            (r) => r.state.area === to
          );
          expect([run.r.state.area, run.outside]).toEqual([to, 0]);
          expect(run.t).toBeLessThanOrEqual(1.5);
          // The funnel: it went through clear of the jambs (the body never
          // touched them), not by grazing round one.
          const off = Math.abs(
            (run.r.state.x - c[0]) * tx + (run.r.state.y - c[1]) * ty
          );
          const half =
            Math.hypot(s.at[1][0] - s.at[0][0], s.at[1][1] - s.at[0][1]) / 2;
          expect(off).toBeLessThanOrEqual(half - WALK_RADIUS_M);
        });
      }
    }
  }
});

describe("every flight up and down", () => {
  const flights = rooms.filter((a) => a.kind === "flight" && a.axis);
  it("covers the flights", () => {
    expect(flights.length).toBe(8);
  });

  for (const f of flights) {
    for (const up of [false, true]) {
      it(`${f.id} ${up ? "up" : "down"}`, () => {
        const [top, bottom] = f.axis!;
        const [a, b] = up ? [bottom, top] : [top, bottom];
        const fromRoom = roomAcross(f.id, a);
        const toRoom = roomAcross(f.id, b);
        expect([fromRoom, toRoom].includes(null)).toBe(false);
        const [ux, uy, L] = unit(a, b);
        const start: V2 = [a[0] - ux * 0.8, a[1] - uy * 0.8];
        const limit = (L + 1.3) / (0.8 * SPEED) + 1;
        const run = bot(
          { ...walker(fromRoom!, start, Math.atan2(uy, ux)), moveShare: 0 },
          FORWARD,
          limit,
          (r) => r.state.area === toRoom
        );
        expect([run.r.state.area, run.outside]).toEqual([toRoom, 0]);
        expect(run.worstFloor).toBeLessThanOrEqual(0.1);
      });
    }
  }
});

describe("the corners the kit kept (seam ends) never hold the walker", () => {
  /** Reflex corners of every walkable room. */
  const corners: { room: WalkArea; v: V2; inX: number; inY: number }[] = [];
  for (const room of rooms) {
    const poly = room.outline;
    for (let i = 0; i < poly.length; i += 1) {
      const p = poly[(i + poly.length - 1) % poly.length];
      const v = poly[i];
      const q = poly[(i + 1) % poly.length];
      const turn =
        (v[0] - p[0]) * (q[1] - v[1]) - (v[1] - p[1]) * (q[0] - v[0]);
      if (turn >= -1e-9) continue; // convex or straight
      // Into the room, away from the corner: minus the two outward normals.
      const [ax, ay] = unit(p, v);
      const [bx, by] = unit(v, q);
      const ox = ay + by;
      const oy = -ax - bx;
      const len = Math.hypot(ox, oy);
      corners.push({ room, v, inX: -ox / len, inY: -oy / len });
    }
  }

  it("probes every reflex corner (some are seam ends)", () => {
    expect(corners.length).toBeGreaterThan(4);
  });

  it("aimed past a corner at an angle, the walker slides round it", () => {
    let probed = 0;
    const held: string[] = [];
    for (const { room, v, inX, inY } of corners) {
      const start: V2 = [v[0] + inX * 0.8, v[1] + inY * 0.8];
      if (!pointInPolygon(start, room.outline)) continue;
      if (insideBlocker(map, room.id, start, WALK_RADIUS_M)) continue;
      const toward = Math.atan2(-inY, -inX);
      for (const aim of [20, -20, 40, -40]) {
        probed += 1;
        const s0 = walker(room.id, start, toward + aim * DEG);
        const run = bot(s0, FORWARD, 1.5);
        const moved = Math.hypot(
          run.r.state.x - start[0],
          run.r.state.y - start[1]
        );
        if (run.outside > 0 || moved < 1.0)
          held.push(`${room.id} [${v}] ${aim}° moved ${moved.toFixed(2)}`);
      }
    }
    expect(probed).toBeGreaterThan(8);
    expect(held).toEqual([]);
  });

  it("pushed square into a corner, it backs out again", () => {
    const held: string[] = [];
    for (const { room, v, inX, inY } of corners) {
      const start: V2 = [v[0] + inX * 0.8, v[1] + inY * 0.8];
      if (!pointInPolygon(start, room.outline)) continue;
      if (insideBlocker(map, room.id, start, WALK_RADIUS_M)) continue;
      const toward = Math.atan2(-inY, -inX);
      const into = bot(walker(room.id, start, toward), FORWARD, 1).r.state;
      const out = bot({ ...into, yaw: toward + Math.PI }, FORWARD, 0.6).r.state;
      const moved = Math.hypot(out.x - into.x, out.y - into.y);
      if (moved < 0.8)
        held.push(`${room.id} [${v}] backed ${moved.toFixed(2)}`);
    }
    expect(held).toEqual([]);
  });
});

/** mulberry32: a small seeded PRNG. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("a seeded random walk in every zone", () => {
  const zones = new Map<string, string[]>();
  for (const r of TITANIC_INTERIOR.rooms) {
    if (r.noWalk) continue;
    const list = zones.get(r.zone) ?? [];
    list.push(r.id);
    zones.set(r.zone, list);
  }

  /** A start in the zone: the first room centroid that stands clear. */
  function startIn(ids: string[]): WalkerState {
    for (const id of ids) {
      const o = area(id).outline;
      const cx = o.reduce((s, p) => s + p[0], 0) / o.length;
      const cy = o.reduce((s, p) => s + p[1], 0) / o.length;
      if (
        pointInPolygon([cx, cy], o) &&
        !insideBlocker(map, id, [cx, cy], WALK_RADIUS_M)
      )
        return walker(id, [cx, cy], 0);
    }
    throw new Error(`no start in ${ids}`);
  }

  for (const [zone, ids] of zones) {
    it(`${zone}: 2 minutes, never outside, never stuck 3 s`, () => {
      const rand = rng(0x5eed + zone.length * 7919 + zone.charCodeAt(0));
      const home = startIn(ids);
      let s: WalkerState = home;
      let input: WalkInput = FORWARD;
      let next = 0;
      const hist: V2[] = [];
      const W3 = Math.round(3 / DT);
      const W05 = Math.round(0.5 / DT);
      let outside = 0;
      let stuck = 0;
      let worstFloor = 0;
      let insideSteps = 0;
      let picks = 0;
      let lastPick = 0;
      let stops = 0;
      for (let i = 0; i < Math.round(120 / DT); i += 1) {
        const t = i * DT;
        const n = hist.length;
        // A child: a new direction every 0.4–1.2 s, or sooner when stopped.
        // Stopped for 0.5 s since the last new direction (so a real trap
        // gets six fresh directions in 3 s and still fails "stuck").
        const stopped =
          t - lastPick >= 0.5 &&
          n > W05 &&
          Math.hypot(s.x - hist[n - W05][0], s.y - hist[n - W05][1]) < 0.15;
        if (stopped) stops += 1;
        if (t >= next || stopped) {
          picks += 1;
          lastPick = t;
          // Stopped: turn away (within 90° of straight back), as a child
          // would; so only a real trap can hold the walker for 3 s.
          s = {
            ...s,
            yaw: stopped
              ? s.yaw + Math.PI + (rand() - 0.5) * Math.PI
              : rand() * 2 * Math.PI,
          };
          const m = 0.5 + 0.5 * rand();
          const side = !stopped && rand() < 0.25 ? (rand() - 0.5) * 1.2 : 0;
          input = { forward: m, strafe: side, lookDx: 0, lookDy: 0 };
          next = t + 0.4 + 0.8 * rand();
        }
        const z = floorOf(s);
        const r = stepWalker(s, input, CTX, DT);
        s = r.state;
        // A lift is meant to change the floor.
        const lifted = r.via?.kind === "lift";
        if (!area(s.area).interior) {
          // Out a deck door: back to the zone's start (it is the inside we test).
          s = home;
          hist.length = 0;
          continue;
        }
        insideSteps += 1;
        if (!inOwn(s)) outside += 1;
        if (!lifted)
          worstFloor = Math.max(worstFloor, Math.abs(floorOf(s) - z));
        hist.push([s.x, s.y]);
        if (hist.length > W3) {
          let far = 0;
          const [x0, y0] = hist[hist.length - 1 - W3];
          for (let k = hist.length - W3; k < hist.length; k += 1)
            far = Math.max(far, Math.hypot(hist[k][0] - x0, hist[k][1] - y0));
          if (far < 0.2) stuck += 1;
          if (hist.length > 2 * W3) hist.splice(0, W3);
        }
      }
      expect({ outside, stuck }).toEqual({ outside: 0, stuck: 0 });
      // Re-aims forced by being stopped stay rare (walls and corners, not
      // traps): otherwise the 3 s check above could hide a sticky spot.
      expect(stops / picks).toBeLessThan(0.25);
      expect(worstFloor).toBeLessThanOrEqual(0.1);
      expect(insideSteps).toBeGreaterThan(Math.round(60 / DT));
    });
  }
});

describe("the rules themselves", () => {
  const sr = "scotland-road";

  it("eases in from standing over WALK_INSIDE_EASE_S; stopping is instant", () => {
    const s0 = { ...walker(sr, [30, 4.3], Math.PI), moveShare: 0 };
    const first = stepWalker(s0, FORWARD, CTX, DT);
    const moved1 = Math.hypot(first.state.x - 30, first.state.y - 4.3);
    expect(moved1).toBeCloseTo(SPEED * DT * (DT / WALK_INSIDE_EASE_S), 6);
    const ramp = bot(s0, FORWARD, WALK_INSIDE_EASE_S + 2 * DT).r.state;
    expect(ramp.moveShare).toBe(1);
    const full = stepWalker(ramp, FORWARD, CTX, DT).state;
    expect(Math.hypot(full.x - ramp.x, full.y - ramp.y)).toBeCloseTo(
      SPEED * DT,
      6
    );
    const still = stepWalker(full, { ...FORWARD, forward: 0 }, CTX, DT).state;
    expect([still.x, still.y, still.moveShare]).toEqual([full.x, full.y, 0]);
  });

  it("a walker without moveShare walks at full speed (deck states unchanged)", () => {
    const r = stepWalker(walker(sr, [30, 4.3], Math.PI), FORWARD, CTX, DT);
    expect(30 - r.state.x).toBeCloseTo(SPEED * DT, 6);
    const deck = stepWalker(
      walker("boat-deck", map.spawn.at, map.spawn.yaw),
      FORWARD,
      CTX,
      DT
    );
    expect("moveShare" in deck.state).toBe(false);
  });

  it("hall assist: 8° off Scotland Road's axis walks straight down it", () => {
    const yaw = Math.PI + 8 * DEG;
    const run = bot(walker(sr, [30, 4.3], yaw), FORWARD, 3);
    expect(Math.abs(run.r.state.y - 4.3)).toBeLessThan(1e-6);
    expect(30 - run.r.state.x).toBeCloseTo(3 * SPEED, 6);
    expect(run.r.state.yaw).toBe(yaw);
  });

  it("wall slide keeps SLIDE_KEEP of the speed 60° off the wall", () => {
    // gs-a's aft part is open: x 31..35, y −7..7. Walk at the y = 7 wall.
    const s0 = walker("gs-a", [32, 5.5], 60 * DEG);
    const into = bot(s0, FORWARD, 1).r.state;
    expect(into.y).toBeCloseTo(7 - WALK_RADIUS_M, 3);
    const next = stepWalker(into, FORWARD, CTX, DT).state;
    expect(next.x - into.x).toBeGreaterThanOrEqual(0.75 * SPEED * DT - 1e-9);
    // Straight into it still stops.
    const square = stepWalker({ ...into, yaw: 90 * DEG }, FORWARD, CTX, DT);
    expect(Math.abs(square.state.x - into.x)).toBeLessThan(1e-6);
  });

  describe("deep water is a wall", () => {
    /** Water 1.2 m over the floor on Scotland Road's port half (y > 4.6). */
    const EDGE_Y = 4.6;
    const waterZ = (id: string, x: number, y: number) => {
      if (id !== sr || y <= EDGE_Y) return -1000;
      return shipToEarth(POSE, [x, y, floorZ(map, id, x, spec, y)])[2] + 1.2;
    };
    const wet: StepContext = { ...CTX, waterZ };

    it("walking into it stops at the edge", () => {
      const run = bot(
        walker(sr, [30, 3.6], 90 * DEG),
        FORWARD,
        2,
        undefined,
        wet
      );
      expect(run.r.inWater).toBeNull();
      expect(run.r.state.y).toBeLessThanOrEqual(EDGE_Y);
      expect(run.r.state.y).toBeGreaterThan(EDGE_Y - 0.1);
      expect(run.r.depthM).toBeLessThan(WALK_WADE_STOP_M);
    });

    it("pushing along it at an angle still slides along the edge", () => {
      const run = bot(
        walker(sr, [30, 3.6], 45 * DEG),
        FORWARD,
        2,
        undefined,
        wet
      );
      expect(run.r.inWater).toBeNull();
      expect(run.r.state.y).toBeLessThanOrEqual(EDGE_Y);
      expect(run.r.state.x - 30).toBeGreaterThan(2);
    });

    it("standing in deep water you can still wade about (not deeper)", () => {
      const level = (id: string, x: number, y: number) =>
        shipToEarth(POSE, [x, y, floorZ(map, id, x, spec, y)])[2] + 0.9;
      const run = bot(walker(sr, [30, 4.3], Math.PI), FORWARD, 1, undefined, {
        ...CTX,
        waterZ: level,
      });
      expect(run.r.inWater).toBeNull();
      expect(30 - run.r.state.x).toBeGreaterThan(1);
    });
  });
});
