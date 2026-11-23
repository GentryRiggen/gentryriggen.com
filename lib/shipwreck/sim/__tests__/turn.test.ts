import type { Opening, ShipSpec } from "../../ships/types";
import { headingAt } from "../headway";
import { simulate } from "../run";
import type { SimFrame, SimTrack } from "../track";
import { longShip, threeShip } from "./testShips";

/**
 * A turn (1.4, the Britannic's turn to starboard for Kea): her heading
 * from a [shown s, yaw deg] table while she floats, her way carrying her
 * along it in earth x/y. Pose and position only: physics (flooding,
 * pitch, roll) sees a straight course.
 */

const DEG = Math.PI / 180;
const TURN = [
  [0, 0],
  [300, -40],
] as const;
const H: NonNullable<ShipSpec["headway"]> = { startMs: 10, turn: TURN };
const HOLE: Opening = {
  compartmentId: "C",
  areaM2: 0.4,
  zLow: 1,
  zHigh: 2,
  x: 40,
  side: "starboard",
};
const ship = (h: ShipSpec["headway"]) => threeShip({ extra: { headway: h } });

const at = (frames: readonly SimFrame[], t: number): SimFrame =>
  frames.find((f) => f.t >= t - 1e-9) as SimFrame;

describe("the turn", () => {
  let turning: SimTrack;
  let straight: SimTrack;
  beforeAll(() => {
    turning = simulate(ship(H), [HOLE], { endT: 500 });
    straight = simulate(ship({ startMs: 10 }), [HOLE], { endT: 500 });
  });

  it("reads her heading off the table, held past the end", () => {
    expect(headingAt(H, 150)).toBeCloseTo(-20 * DEG, 12);
    expect(headingAt(H, 900)).toBeCloseTo(-40 * DEG, 12);
    expect(headingAt({ startMs: 10 }, 150)).toBe(0);
  });

  it("heads −40° by 400 s and bends her track to starboard", () => {
    const b = at(turning.frames, 400).bodies[0];
    expect(Math.abs(b.yaw / DEG + 40)).toBeLessThan(0.5);
    expect(b.y).toBeLessThan(0);
    // Her way along the new heading: x keeps growing, y keeps falling.
    const later = at(turning.frames, 450).bodies[0];
    expect(later.x).toBeGreaterThan(b.x);
    expect(later.y).toBeLessThan(b.y);
    // The straight run stays on the x axis (but for the drift).
    expect(Math.abs(at(straight.frames, 400).bodies[0].yaw)).toBe(0);
  });

  it("changes no physics: pitch, roll, heave and water as on a straight course", () => {
    expect(turning.frames).toHaveLength(straight.frames.length);
    turning.frames.forEach((f, i) => {
      const g = straight.frames[i];
      expect(Math.abs(f.bodies[0].pitch - g.bodies[0].pitch)).toBeLessThan(
        1e-9
      );
      expect(Math.abs(f.bodies[0].roll - g.bodies[0].roll)).toBeLessThan(1e-9);
      expect(Math.abs(f.bodies[0].z - g.bodies[0].z)).toBeLessThan(1e-9);
      f.water.forEach((v, k) =>
        expect(Math.abs(v - g.water[k])).toBeLessThan(1e-9)
      );
    });
    expect(at(turning.frames, 400).water[2]).toBeGreaterThan(0.05);
  });

  it("a break keeps both halves on her heading, where she was", () => {
    // A weak girder and a flooded bow: she breaks while still turning.
    const weak = longShip({
      extra: {
        headway: H,
        girder: { hogMaxNm: 2e8, sagMaxNm: 2e8 },
      },
    });
    const bow: Opening = { ...HOLE, compartmentId: "h9", x: 95, areaM2: 4 };
    const track = simulate(weak, [bow], { endT: 290 });
    expect(track.brokeAtT).not.toBeNull();
    const i = track.frames.findIndex((f) => f.bodies.length === 2);
    const before = track.frames[i - 1].bodies[0];
    for (const b of track.frames[i].bodies) {
      expect(Math.abs(b.yaw - before.yaw)).toBeLessThan(0.01);
      expect(Math.hypot(b.x - before.x, b.y - before.y)).toBeLessThan(15);
    }
  });

  it("enginesStopped: no turn, her yaw stays 0", () => {
    const stopped = simulate(ship(H), [HOLE], {
      endT: 500,
      enginesStopped: true,
    });
    for (const f of stopped.frames) expect(f.bodies[0].yaw).toBe(0);
    expect(headingAt(H, 400, { enginesStopped: true })).toBe(0);
  });

  it("a profile ship that floods to bow-under keeps her lost heading, her way along it", () => {
    // Still turning when her bow goes under: the turn stops there (the
    // heading frozen) and what way she has left carries her along it.
    const h: NonNullable<ShipSpec["headway"]> = {
      startMs: 6,
      profile: [
        [0, 6],
        [5000, 6],
      ],
      turn: [
        [0, 0],
        [5000, -80],
      ],
    };
    const ship2 = longShip({ extra: { headway: h } });
    // Her three forward holds open: down by the head in about 6 minutes.
    const holes: Opening[] = [0, 1, 2].map((k) => ({
      ...HOLE,
      compartmentId: `h${9 - k}`,
      x: 95 - 20 * k,
      areaM2: 3,
    }));
    const track = simulate(ship2, holes, { endT: 3000 });
    const under = track.events.find((e) => e.kind === "bow-under");
    expect(under).toBeDefined();
    const tu = under!.t;
    // Still turning before it: her yaw follows the table.
    const before = at(track.frames, tu - 30).bodies[0];
    expect(before.yaw).toBeCloseTo(headingAt(h, tu - 30), 2);
    const held = at(track.frames, tu + 5).bodies[0];
    expect(held.yaw).toBeLessThan(-1 * DEG);
    const end =
      track.events.find((e) => e.kind === "stern-under")?.t ?? tu + 120;
    let last = held;
    let moved = 0;
    for (const f of track.frames) {
      if (f.t <= tu + 5 || f.t >= Math.min(end, tu + 120)) continue;
      const b = f.bodies[0];
      if (b.part !== "whole") break;
      // The heading held where she lost it (the table would go on turning).
      expect(Math.abs(b.yaw - held.yaw)).toBeLessThan(1e-9);
      const dx = b.x - last.x;
      const dy = b.y - last.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.05) {
        // Her way along that heading.
        const dir = Math.atan2(dy, dx);
        expect(Math.abs(dir - held.yaw)).toBeLessThan(5 * DEG);
        moved += d;
      }
      last = b;
    }
    expect(moved).toBeGreaterThan(5);
    expect(headingAt(h, tu + 120)).toBeLessThan(held.yaw - 1 * DEG);
  });
});
