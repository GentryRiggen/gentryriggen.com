import { concordia } from "../../ships/concordia";
import type { BodyPose, SimFrame } from "../../sim/track";
import { CONCORDIA_INTERIOR } from "../concordia";
import {
  extendSeep,
  ROOM_SEEP_M_PER_S,
  seepFor,
  seepLevelAt,
  seepLevels,
  seepTarget,
} from "../seep";
import type { InteriorMap, Room } from "../types";

/**
 * A synthetic ship: a level 4 x 4 m room on deck "3" (floor 1 m over her
 * origin) under a sea that rises 2 m in 10 s (her pose sinks).
 */
const spec = {
  decks: [{ name: "3", z: 1 }],
  sheerZ: () => 0,
} as unknown as Parameters<typeof seepLevels>[2];

const room = (id: string, seep: boolean): Room => ({
  id,
  kind: "cabin",
  deck: "3",
  outline: [
    [0, 0],
    [4, 0],
    [4, 4],
    [0, 4],
  ],
  ceilingM: 2.5,
  zone: "z",
  look: { finish: "oak", floor: "lino", lamp: "sconce" },
  ...(seep ? { seep: true as const } : {}),
});

const interior = {
  ship: "titanic",
  rooms: [room("a", true), room("b", false)],
  seams: [],
  links: [],
  shutDoors: [],
  furniture: [],
} as unknown as InteriorMap;

/** A frame at shown time t with the origin at z (level, pitch 0). */
function frame(t: number, z: number): SimFrame {
  const b: BodyPose = {
    part: "whole",
    x: 0,
    y: 0,
    z,
    pitch: 0,
    roll: 0,
    yaw: 0,
  };
  return {
    t,
    realT: t,
    bodies: [b],
    water: [],
    waterAboardT: 0,
    trimDeg: 0,
    listDeg: 0,
    power: 1,
    groundedParts: [],
  };
}

/** The sea rises 2 m in 10 s: the origin sinks from +0 to -2 m over frames 1 s apart; the floor is 1 m up, so the sea is over it from about 5 s... */
const frames: SimFrame[] = Array.from({ length: 21 }, (_, i) =>
  frame(i, -i * 0.2 + 0.3)
);
// Floor z = origin + 1: over the sea (z 0) while origin > -1; wet from i = 7.
const FLOOR = 1;

describe("seepLevels", () => {
  const table = seepLevels(interior, frames, spec);

  it("leaves rooms without seep out of the table", () => {
    expect(table.levels[1]).toBeUndefined();
    expect(Number.isNaN(seepLevelAt(table, 1, 5))).toBe(true);
    expect(table.index.get("b")).toBe(1);
  });

  it("is dry until the sea is over the room's lowest floor point, then starts there", () => {
    let firstWet = -1;
    for (let i = 0; i < frames.length; i += 1) {
      const low = frames[i].bodies[0].z + FLOOR;
      const level = seepLevelAt(table, 0, frames[i].t);
      if (low >= 0) {
        expect(level).toBe(-Infinity);
      } else if (firstWet < 0) {
        firstWet = i;
        // Starts at the lowest floor point itself (nothing over it yet).
        expect(level).toBeCloseTo(low, 9);
      }
    }
    expect(firstWet).toBeGreaterThan(0);
  });

  it("raises the water over the floor at most 0.005 m a second, never above the sea", () => {
    expect(ROOM_SEEP_M_PER_S).toBe(0.005);
    let prevDepth = 0;
    for (let t = 0; t <= 20; t += 0.25) {
      const level = seepLevelAt(table, 0, t);
      expect(level).toBeLessThanOrEqual(0 + 1e-9);
      if (level === -Infinity) continue;
      const i = Math.min(20, Math.floor(t));
      const next = Math.min(20, i + 1);
      const u = t - i;
      const low =
        frames[i].bodies[0].z * (1 - u) + frames[next].bodies[0].z * u + FLOOR;
      const depth = level - low;
      expect(depth).toBeGreaterThanOrEqual(-1e-9);
      expect(depth - prevDepth).toBeLessThanOrEqual(
        ROOM_SEEP_M_PER_S * 0.25 + 1e-9
      );
      prevDepth = depth;
    }
    // Over 13 s of wet frames the room only holds a few centimetres, though
    // the sea over its floor is more than a metre deep by then.
    expect(prevDepth).toBeLessThan(0.1);
    expect(0 - (frames[20].bodies[0].z + FLOOR)).toBeGreaterThan(2);
  });

  it("follows the sea when the sea is shallower than the seep would allow", () => {
    // 1000 s of a sea only 5 cm over the floor: the room just holds the sea.
    const slow = [frame(0, -1.05), frame(1000, -1.05)];
    const t2 = seepLevels(interior, slow, spec);
    expect(seepLevelAt(t2, 0, 1000)).toBeCloseTo(0, 9);
  });

  it("never drains, and keeps its water under the sea when she rises again", () => {
    const rises = [
      frame(0, -1.5),
      frame(100, -1.5),
      frame(110, 2),
      frame(120, 2),
    ];
    const t3 = seepLevels(interior, rises, spec);
    const wet = seepLevelAt(t3, 0, 100);
    expect(wet).toBeGreaterThan(-0.5);
    // The floor is now above the sea: its plane is capped at the sea.
    expect(seepLevelAt(t3, 0, 120)).toBeLessThanOrEqual(0);
    expect(seepLevelAt(t3, 0, 120)).not.toBe(-Infinity);
  });

  it("is the same by playing or by seeking (a pure lookup)", () => {
    const played: number[] = [];
    for (let t = 0; t <= 20; t += 0.5) played.push(seepLevelAt(table, 0, t));
    const seeked: number[] = [];
    for (let k = 40; k >= 0; k -= 1) seeked[k] = seepLevelAt(table, 0, k * 0.5);
    expect(seeked).toEqual(played);
    const again = seepLevels(interior, frames, spec);
    expect(again.levels).toEqual(table.levels);
  });

  it("extends as the frames grow, to the same table as building it at once", () => {
    const growing = seepLevels(interior, frames.slice(0, 9), spec);
    extendSeep(growing, frames);
    expect(growing.levels).toEqual(table.levels);
    expect(growing.times).toEqual(table.times);
  });

  it("is shared per track by seepFor, and read through seepTarget", () => {
    const a = seepFor(interior, frames, spec);
    expect(seepFor(interior, frames, spec)).toBe(a);
    expect(seepTarget(interior, frames, spec, "a", 20)).toBe(
      seepLevelAt(a, 0, 20)
    );
    expect(Number.isNaN(seepTarget(interior, frames, spec, "b", 20))).toBe(
      true
    );
    expect(Number.isNaN(seepTarget(interior, [], spec, "a", 0))).toBe(true);
  });

  it("makes a table for her rooms: only the four low rooms seep", () => {
    const real = seepLevels(CONCORDIA_INTERIOR, [frame(0, -8)], concordia);
    const ids = CONCORDIA_INTERIOR.rooms
      .filter((_, i) => real.levels[i])
      .map((r) => r.id);
    expect(ids.sort()).toEqual([
      "cabin-inside",
      "cabin-ocean",
      "corridor-1",
      "lobby-1",
    ]);
  });
});
