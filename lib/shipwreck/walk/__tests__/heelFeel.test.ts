import { withInterior } from "../../interior/merge";
import { concordia } from "../../ships/concordia";
import type { BodyPose } from "../../sim/track";
import { CONCORDIA_WALK } from "../concordiaDecks";
import { deckSlope, shipToEarth } from "../slope";
import {
  heelDrift,
  stepWalker,
  WALK_DT,
  type StepContext,
  type StepResult,
  type WalkerState,
  type WalkInput,
} from "../step";
import {
  floorZ,
  HEEL_DRIFT_MS,
  HEEL_FEEL_FROM_DEG,
  HEEL_FEEL_FULL_DEG,
  HEEL_UPHILL_LOSS,
  insideBlocker,
  pointInPolygon,
  seamEdges,
  WALK_RADIUS_M,
  WALK_WADE_STOP_M,
  type V2,
  type WalkArea,
  type WalkMap,
} from "../types";

/**
 * Her lean (spec "Walking as she leans"): synthetic poses on her real deck
 * map, fixed dt 1/60. Keyed on her heel (the pose's roll), never a clock.
 */

const DEG = Math.PI / 180;
const spec = concordia;
const MAP = CONCORDIA_WALK;
/** Her map without the heel feel: how every other ship walks. */
const PLAIN: WalkMap = { ...CONCORDIA_WALK, heelFeel: undefined };
const STILL: WalkInput = { forward: 0, strafe: 0, lookDx: 0, lookDy: 0 };
const DT = WALK_DT;
const R = WALK_RADIUS_M;
/** Far below every deck: these tests are about the lean, not the sea. */
const DRY_SEA = () => -100;

function pose(listDeg: number, trimDeg = 0): BodyPose {
  return {
    part: "whole",
    x: 0,
    y: 0,
    z: -spec.draught,
    pitch: trimDeg * DEG,
    roll: listDeg * DEG,
    yaw: 0,
  };
}

function ctxFor(
  p: BodyPose,
  map: WalkMap = MAP,
  extra: Partial<StepContext> = {}
): StepContext {
  return { map, spec, pose: p, breakX: null, seaZ: DRY_SEA, ...extra };
}

function at(area: string, x: number, y: number, yaw = 0): WalkerState {
  return { part: "whole", area, x, y, yaw };
}

function areaOf(map: WalkMap, id: string): WalkArea {
  const a = map.areas.find((x) => x.id === id);
  if (!a) throw new Error(`no area ${id}`);
  return a;
}

function distToSegment(p: V2, a: V2, b: V2): number {
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
  return Math.hypot(p[0] - a[0] - u * dx, p[1] - a[1] - u * dy);
}

/** Whether a body could stand at p in an area: inside, clear of every edge and blocker. */
function canStand(map: WalkMap, areaId: string, p: V2): boolean {
  const area = areaOf(map, areaId);
  if (!pointInPolygon(p, area.outline)) return false;
  if (insideBlocker(map, areaId, p, R)) return false;
  const seams = seamEdges(map, areaId);
  const poly = area.outline;
  for (let i = 0; i < poly.length; i += 1) {
    if (seams && seams[i] !== null) continue;
    if (distToSegment(p, poly[i], poly[(i + 1) % poly.length]) < R)
      return false;
  }
  return true;
}

/** A standing spot in an area: the clear grid point nearest its middle. */
function standingSpot(map: WalkMap, areaId: string): V2 {
  const poly = areaOf(map, areaId).outline;
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  let best: V2 | null = null;
  let bestD = Infinity;
  for (let x = Math.min(...xs); x <= Math.max(...xs); x += 0.5)
    for (let y = Math.min(...ys); y <= Math.max(...ys); y += 0.5) {
      const p: V2 = [x, y];
      const d = Math.hypot(x - cx, y - cy);
      if (d < bestD && canStand(map, areaId, p)) {
        best = p;
        bestD = d;
      }
    }
  if (!best) throw new Error(`nowhere to stand in ${areaId}`);
  return best;
}

/**
 * What went wrong at a step (null: nothing): in the sea, overboard, outside
 * its area's outline or inside a blocker. Checked without `expect` per step
 * (thousands of steps), then asserted once.
 */
function fault(r: StepResult, map: WalkMap = MAP): string | null {
  const { area, x, y } = r.state;
  if (r.inWater !== null) return `in the sea at ${area} ${x} ${y}`;
  if (r.overboard) return `overboard at ${area} ${x} ${y}`;
  if (!pointInPolygon([x, y], areaOf(map, area).outline))
    return `outside ${area} at ${x} ${y}`;
  if (insideBlocker(map, area, [x, y], R - 1e-6))
    return `in a blocker in ${area} at ${x} ${y}`;
  return null;
}

/** Runs `seconds` of frames at 1/60, calling `each` after every step. */
function run(
  w: WalkerState,
  input: WalkInput | ((i: number) => WalkInput),
  ctx: StepContext,
  seconds: number,
  each?: (r: StepResult, i: number) => void
): WalkerState {
  let s = w;
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i += 1) {
    const r = stepWalker(
      s,
      typeof input === "function" ? input(i) : input,
      ctx,
      DT
    );
    each?.(r, i);
    s = r.state;
  }
  return s;
}

describe("heelDrift", () => {
  it("is nothing up to 8°, full at 30°, linear between, along her downhill", () => {
    expect(HEEL_FEEL_FROM_DEG).toBe(8);
    expect(HEEL_FEEL_FULL_DEG).toBe(30);
    expect(HEEL_UPHILL_LOSS).toBe(0.45);
    expect(HEEL_DRIFT_MS).toBe(0.8);
    expect(heelDrift(pose(0)).k).toBe(0);
    expect(heelDrift(pose(7)).k).toBe(0);
    expect(heelDrift(pose(19)).k).toBeCloseTo(0.5, 9);
    expect(heelDrift(pose(30)).k).toBeCloseTo(1, 9);
    expect(heelDrift(pose(40)).k).toBe(1);
    // Listing to starboard (+), downhill is to starboard (−y).
    const d = heelDrift(pose(25));
    expect(d.downhill[0]).toBeCloseTo(0, 9);
    expect(d.downhill[1]).toBeCloseTo(-1, 9);
    expect(heelDrift(pose(-25)).downhill[1]).toBeCloseTo(1, 9);
  });

  it("is her map's alone", () => {
    expect(MAP.heelFeel).toBe(true);
    expect(MAP.eyesShipUp).toBe(true);
    expect(MAP.swimAroundSuperstructure).toBe(true);
    expect(MAP.walkEndsAtHeelDeg).toBe(40);
  });

  it("keeps her flags when rooms are merged into her map", () => {
    const merged = withInterior(MAP, {
      ship: "concordia",
      rooms: [],
      seams: [],
      links: [],
      shutDoors: [],
      furniture: [],
    });
    expect(merged.heelFeel).toBe(true);
    expect(merged.eyesShipUp).toBe(true);
    expect(merged.swimAroundSuperstructure).toBe(true);
    expect(merged.walkEndsAtHeelDeg).toBe(40);
  });
});

describe("walking as she leans", () => {
  /** A walk with turns, strafes and stops from the spawn. */
  const script = (i: number): WalkInput => ({
    forward: i < 90 ? 1 : i < 150 ? 0 : -0.6,
    strafe: i < 60 ? 0 : i < 200 ? 0.7 : -1,
    lookDx: i % 50 === 0 ? 40 : 0,
    lookDy: 0,
  });

  it("walks a level ship exactly as a map without the heel feel", () => {
    for (const p of [pose(0), pose(7), pose(-7, 2)]) {
      const w = at(MAP.spawn.area, MAP.spawn.at[0], MAP.spawn.at[1]);
      const a: WalkerState[] = [];
      const b: WalkerState[] = [];
      run(w, script, ctxFor(p, MAP), 5, (r) => a.push(r.state));
      run(w, script, ctxFor(p, PLAIN), 5, (r) => b.push(r.state));
      expect(a).toEqual(b);
    }
  });

  it("does not drift at 7°", () => {
    const w = at("pool-hall", 30, -10);
    const end = run(w, STILL, ctxFor(pose(7)), 5);
    expect(end.x).toBe(30);
    expect(end.y).toBe(-10);
  });

  it("standing still at 30° slides downhill and stops against the low wall", () => {
    const hall = areaOf(MAP, "pool-hall");
    const ys: number[] = [];
    const end = run(
      at("pool-hall", 30, -10),
      STILL,
      ctxFor(pose(30)),
      5,
      (r) => {
        ys.push(r.state.y);
        expect(pointInPolygon([r.state.x, r.state.y], hall.outline)).toBe(true);
      }
    );
    // Downhill all the way, never back up.
    for (let i = 1; i < ys.length; i += 1)
      expect(ys[i]).toBeLessThanOrEqual(ys[i - 1] + 1e-12);
    // Against the starboard glass wall (y −13.5), the body's radius off it.
    const low = Math.min(...hall.outline.map((p) => p[1]));
    expect(end.y).toBeCloseTo(low + R, 2);
    expect(end.x).toBeCloseTo(30, 6);
  });

  it("is off while the drift is held off (input off, a ride)", () => {
    const end = run(
      at("pool-hall", 30, -10),
      STILL,
      ctxFor(pose(30), MAP, { driftOff: true }),
      2
    );
    expect(end.y).toBe(-10);
  });

  it("straight uphill on deck at 40° still nets 1.4 m/s", () => {
    // Listing to starboard: uphill is to port (+y); yaw π/2 faces it.
    const w = at("pool-hall", 30, -12, Math.PI / 2);
    const end = run(w, { ...STILL, forward: 1 }, ctxFor(pose(40)), 3);
    const net = (end.y - w.y) / 3;
    expect(net).toBeGreaterThanOrEqual(1.4 - 1e-9);
    expect(net).toBeCloseTo(4 * (1 - HEEL_UPHILL_LOSS) - HEEL_DRIFT_MS, 6);
  });

  it("straight uphill inside at 30° still nets over 0.6 m/s", () => {
    const room: WalkMap = {
      ship: "concordia",
      heelFeel: true,
      areas: [
        {
          id: "room",
          deck: "7",
          interior: true,
          outline: [
            [0, -10],
            [20, -10],
            [20, 10],
            [0, 10],
          ],
        },
      ],
      blockers: [],
      stairs: [],
      spawn: { area: "room", at: [10, -8], yaw: Math.PI / 2 },
    };
    const forward = { ...STILL, forward: 1 };
    const c = ctxFor(pose(30), room);
    // Past the ease-in, then 2.5 s of walking.
    const mid = run(at("room", 10, -8, Math.PI / 2), forward, c, 0.5);
    const end = run(mid, forward, c, 2.5);
    expect((end.y - mid.y) / 2.5).toBeGreaterThan(0.6);
  });

  it("walking downhill is faster than walking uphill", () => {
    const c = ctxFor(pose(25));
    const up = run(
      at("pool-hall", 30, -10, Math.PI / 2),
      { ...STILL, forward: 1 },
      c,
      1
    );
    const down = run(
      at("pool-hall", 30, 10, -Math.PI / 2),
      { ...STILL, forward: 1 },
      c,
      1
    );
    expect(Math.abs(down.y - 10)).toBeGreaterThan(Math.abs(up.y + 10) + 1);
  });
});

describe("the drift is always safe", () => {
  it("never takes a stair or door on its own, but the stick still does", () => {
    let entered = 0;
    let tried = 0;
    for (const st of MAP.stairs)
      for (const end of [st.from, st.to])
        for (const list of [30, -30, 40, -40]) {
          const [ux, uy] = deckSlope(pose(list)).downhill.map((v) => -v);
          const r = st.widthM / 2;
          const start: V2 = [
            end.at[0] + ux * (r + 0.2),
            end.at[1] + uy * (r + 0.2),
          ];
          if (!canStand(MAP, end.area, start)) continue;
          tried += 1;
          let nearest = Infinity;
          let took: string | null = null;
          run(
            at(end.area, start[0], start[1]),
            STILL,
            ctxFor(pose(list)),
            6,
            (res) => {
              if (res.via || res.state.area !== end.area)
                took ??= `${st.id} from ${end.area} at ${list}°`;
              nearest = Math.min(
                nearest,
                Math.hypot(res.state.x - end.at[0], res.state.y - end.at[1])
              );
            }
          );
          expect(took).toBeNull();
          if (nearest < r) entered += 1;
          // Walking downhill into it from there takes it.
          const yaw = Math.atan2(-uy, -ux);
          let via: StepResult["via"];
          run(
            at(end.area, start[0], start[1], yaw),
            { ...STILL, forward: 1 },
            ctxFor(pose(list)),
            0.5,
            (res) => {
              via ??= res.via;
            }
          );
          expect(via?.id).toBe(st.id);
        }
    // Most ends were tried, and the drift carried the walker inside them.
    expect(tried).toBeGreaterThanOrEqual(MAP.stairs.length * 2);
    expect(entered).toBeGreaterThanOrEqual(tried / 2);
  });

  it("standing still on every deck at 30° and 40° holds: no rail, no blocker, no sea", () => {
    for (const area of MAP.areas)
      for (const list of [30, -30, 40, -40]) {
        const [x, y] = standingSpot(MAP, area.id);
        let bad: string | null = null;
        const end = run(
          at(area.id, x, y),
          STILL,
          ctxFor(pose(list)),
          6,
          (r) => {
            bad ??= fault(r) ?? (r.state.area !== area.id ? "left" : null);
          }
        );
        expect(bad).toBeNull();
        // It came to rest against something, or slides along it.
        expect(Math.hypot(end.x - x, end.y - y)).toBeGreaterThan(0);
      }
  });

  it("stops against her sea rail on the terrace and the boat deck", () => {
    for (const id of ["aft-terrace", "boat-deck-s"]) {
      const area = areaOf(MAP, id);
      const [x, y] = standingSpot(MAP, id);
      // The terrace is 33 m across: long enough to reach its low rail.
      let bad: string | null = null;
      const end = run(at(id, x, y), STILL, ctxFor(pose(30)), 30, (r) => {
        bad ??= fault(r);
      });
      expect(bad).toBeNull();
      expect(pointInPolygon([end.x, end.y], area.outline)).toBe(true);
      // Against the low rail or a boat: at rest, or creeping along the
      // terrace's slanting rail (the corner rule), far slower than a drift.
      const after = run(end, STILL, ctxFor(pose(30)), 1);
      expect(Math.hypot(after.x - end.x, after.y - end.y)).toBeLessThan(0.05);
      if (id === "aft-terrace") {
        const low = Math.min(...area.outline.map((q) => q[1]));
        expect(end.y).toBeLessThan(low + 1 + R);
      }
    }
  });

  it("is pushed back by a blocker: the pool's basin and the slide's tower", () => {
    // Uphill (+y) of the hall's pool: onto its edge, never into it.
    const end = run(at("pool-hall", 16, 6), STILL, ctxFor(pose(30)), 5, (r) => {
      expect(
        insideBlocker(MAP, r.state.area, [r.state.x, r.state.y], R - 1e-6)
      ).toBe(false);
    });
    const basin = MAP.blockers.find(
      (b) => b.area === "pool-hall" && b.kind === "box"
    );
    if (basin?.kind !== "box") throw new Error("no basin");
    expect(end.y).toBeCloseTo(basin.max[1] + R, 2);
    // Just off the slide tower's middle: it slides round it.
    const tower = MAP.blockers.find(
      (b) => b.area === "lido-fwd" && b.kind === "circle"
    );
    if (tower?.kind !== "circle") throw new Error("no tower");
    const [tx, ty] = tower.at;
    const start = at("lido-fwd", tx + 0.4, ty + tower.r + 1);
    run(start, STILL, ctxFor(pose(30)), 10, (r) => {
      expect(
        insideBlocker(MAP, "lido-fwd", [r.state.x, r.state.y], R - 1e-6)
      ).toBe(false);
    });
  });

  it("never carries the walker into water too deep to wade", () => {
    // The sea up her starboard boat deck: 1.5 m over the rail's feet.
    const p = pose(30);
    const deck = areaOf(MAP, "boat-deck-s");
    const xMid = -30;
    // Her rail amidships (the outline's most starboard point).
    const rail = Math.min(...deck.outline.map((q) => q[1]));
    const railFeet = shipToEarth(p, [
      xMid,
      rail,
      floorZ(MAP, "boat-deck-s", xMid, spec),
    ]);
    const sea = railFeet[2] + 1.5;
    const c = ctxFor(p, MAP, { seaZ: () => sea });
    // Start by the recess wall, dry, between boats or not: still for 15 s.
    const [x, y] = standingSpot(MAP, "boat-deck-s");
    let deepest = -Infinity;
    run(at("boat-deck-s", x, y), STILL, c, 15, (r) => {
      expect(r.inWater).toBeNull();
      deepest = Math.max(deepest, r.depthM);
    });
    expect(deepest).toBeLessThanOrEqual(WALK_WADE_STOP_M + 1e-9);
  });
});

describe("a minute of wandering on every deck at 35°", () => {
  /** A small seeded generator (deterministic). */
  function lcg(seed: number) {
    let s = seed >>> 0;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  /** Whether some way out moves the walker 0.3 m in half a second. */
  function canMove(w: WalkerState, c: StepContext): boolean {
    for (let k = 0; k < 8; k += 1) {
      const probe = run(
        { ...w, yaw: (k * Math.PI) / 4 },
        { ...STILL, forward: 1 },
        c,
        0.5
      );
      if (Math.hypot(probe.x - w.x, probe.y - w.y) >= 0.3) return true;
    }
    return false;
  }

  it("never leaves an outline, never enters a blocker, never stuck", () => {
    const c = ctxFor(pose(35));
    let bad: string | null = null;
    for (const [n, area] of MAP.areas.entries()) {
      const rnd = lcg(1000 + n);
      const [x, y] = standingSpot(MAP, area.id);
      let s = at(area.id, x, y, rnd() * 2 * Math.PI);
      let input: WalkInput = STILL;
      let nextChange = 0;
      for (let i = 0; i < 60 * 60; i += 1) {
        if (i >= nextChange) {
          const stand = rnd() < 0.2;
          input = {
            forward: stand ? 0 : rnd() * 2 - 1,
            strafe: stand ? 0 : rnd() * 2 - 1,
            lookDx: (rnd() - 0.5) * 200,
            lookDy: 0,
          };
          nextChange = i + 30 + Math.floor(rnd() * 60);
        } else if (input.lookDx !== 0) input = { ...input, lookDx: 0 };
        const r = stepWalker(s, input, c, DT);
        s = r.state;
        bad ??= fault(r);
        // Every 3 s: some way out still moves them (never pinned).
        if (i % 180 === 179 && !canMove(s, c))
          bad ??= `stuck in ${s.area} at ${s.x} ${s.y}`;
      }
    }
    expect(bad).toBeNull();
  });
});
