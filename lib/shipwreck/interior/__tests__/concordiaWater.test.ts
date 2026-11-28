import { concordia } from "../../ships/concordia";
import type { SimFrame } from "../../sim/track";
import { shipToEarth } from "../../walk/slope";
import poses from "./fixtures/concordiaPoses.json";
import { CONCORDIA_INTERIOR } from "../concordia";
import { seepLevelAt, seepLevels } from "../seep";
import { roomFloorZ } from "../water";

/**
 * Her low rooms on her real night (the poses are a saved copy, a frame
 * every 10 s: `concordiaPosesFixture.test.ts` keeps them true). Keyed on
 * heel, never the clock: the touch is the 12.9° step, the close 30°.
 */

const frames: SimFrame[] = poses.map((p) => ({
  t: p.t,
  realT: p.t,
  bodies: [
    {
      part: "whole",
      x: p.pose[0],
      y: p.pose[1],
      z: p.pose[2],
      pitch: p.pose[3],
      roll: p.pose[4],
      yaw: p.pose[5],
    },
  ],
  water: [],
  waterAboardT: 0,
  trimDeg: 0,
  listDeg: p.listDeg,
  power: p.power,
  groundedParts: [],
}));
const table = seepLevels(CONCORDIA_INTERIOR, frames, concordia);
const index = (id: string) =>
  CONCORDIA_INTERIOR.rooms.findIndex((r) => r.id === id);

/** Water over the floor at (x, y) of a room, at a frame (m, negative dry). */
function depth(id: string, x: number, y: number, f: SimFrame): number {
  const i = index(id);
  const room = CONCORDIA_INTERIOR.rooms[i];
  const z = shipToEarth(f.bodies[0], [
    x,
    y,
    roomFloorZ(room, x, y, concordia),
  ])[2];
  return seepLevelAt(table, i, f.t) - z;
}

const firstAt = (heel: number) =>
  frames.findIndex((f) => Math.abs(f.listDeg) >= heel);
const STBD: [number, number] = [59, -13.4];
const PORT: [number, number] = [59, 5.9];

describe("her low rooms on her real night", () => {
  it("has her night's heel steps where the spec puts them", () => {
    expect(firstAt(12.9)).toBeGreaterThan(0);
    expect(firstAt(30)).toBeGreaterThan(firstAt(25));
  });

  it("keeps lobby-1's starboard edge dry until the touch (12.9°)", () => {
    for (let i = 0; i < firstAt(12.9); i += 1)
      expect(depth("lobby-1", ...STBD, frames[i])).toBeLessThanOrEqual(0);
  });

  it("wets it at least two shown minutes before 30°", () => {
    const close = frames[firstAt(30)].t;
    const wet = frames.find(
      (f) => f.t <= close && depth("lobby-1", ...STBD, f) > 0.01
    );
    expect(wet).toBeDefined();
    expect(close - wet!.t).toBeGreaterThanOrEqual(120);
  });

  it("has the outboard cabin knee deep (0.5 m) before 30°", () => {
    const i = index("cabin-ocean");
    const room = CONCORDIA_INTERIOR.rooms[i];
    let deepest = 0;
    for (const f of frames.slice(0, firstAt(30)))
      for (const [x, y] of room.outline)
        deepest = Math.max(deepest, depth("cabin-ocean", x, y, f));
    expect(deepest).toBeGreaterThanOrEqual(0.5);
  });

  it("gathers low: at 25° the lobby's starboard side is under and its port side dry", () => {
    const f = frames[firstAt(25)];
    expect(depth("lobby-1", ...STBD, f)).toBeGreaterThan(0.05);
    expect(depth("lobby-1", ...PORT, f)).toBeLessThan(0);
  });

  it("rises slowly: no room gains more than 0.005 m a shown second over its lowest point", () => {
    // The level moves with her tilt, so look at how the water is fed: the
    // depth over each room's lowest corner between frames.
    for (const id of ["lobby-1", "corridor-1", "cabin-inside", "cabin-ocean"]) {
      const room = CONCORDIA_INTERIOR.rooms[index(id)];
      for (let k = 1; k < frames.length; k += 1) {
        const a = frames[k - 1];
        const b = frames[k];
        const low = (f: SimFrame) =>
          Math.min(
            ...room.outline.map(
              ([x, y]) =>
                shipToEarth(f.bodies[0], [
                  x,
                  y,
                  roomFloorZ(room, x, y, concordia),
                ])[2]
            )
          );
        const depthLow = (f: SimFrame) => {
          const level = seepLevelAt(table, index(id), f.t);
          return level === -Infinity ? 0 : Math.max(0, level - low(f));
        };
        // Either the sea feeds it (depth = the sea over the lowest point)
        // or the seep does, 0.005 m/s at most.
        const sea = Math.max(0, -low(b));
        const gain = depthLow(b) - depthLow(a);
        if (depthLow(b) < sea - 1e-6)
          expect(gain).toBeLessThanOrEqual(0.005 * (b.t - a.t) + 1e-6);
      }
    }
  });
});
