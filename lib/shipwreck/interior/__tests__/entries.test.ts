import { titanic } from "../../ships/titanic";
import { sampleTrack, simulate, type SimTrack } from "../../sim";
import type { BodyPose } from "../../sim/track";
import {
  insideBlocker,
  pointInPolygon,
  TITANIC_WALK,
  walkMapFor,
  WALK_RADIUS_M,
  WALK_WADE_STOP_M,
  type V2,
  type WalkMap,
} from "../../walk";
import { shipToEarth } from "../../walk/slope";
import { interiorFor, openEntries, roomWaterTargets, type Room } from "..";
import { TITANIC_INTERIOR } from "../titanic";
import { roomFloorZ } from "../water";

const map = walkMapFor("titanic") as WalkMap;
const interior = TITANIC_INTERIOR;
const entries = interior.entries ?? [];
const roomOf = (id: string) => interior.rooms.find((r) => r.id === id)!;

function edgeDist(p: V2, a: V2, b: V2): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const u = Math.max(
    0,
    Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2)
  );
  return Math.hypot(p[0] - (a[0] + u * dx), p[1] - (a[1] + u * dy));
}

/** Level and still: the pose at the start of the night, near enough. */
const LEVEL: BodyPose = {
  part: "whole",
  x: 0,
  y: 0,
  z: -10,
  pitch: 0,
  roll: 0,
  yaw: 0,
};

/** Water standing `over` m over each named room's entry floor. */
function waterOver(over: Record<string, number>) {
  return (room: Room, pose: BodyPose) => {
    const e = entries.find((n) => n.room === room.id);
    const d = over[room.id];
    if (!e || d === undefined) return -Infinity;
    const z = roomFloorZ(room, e.at[0], e.at[1], titanic);
    return shipToEarth(pose, [e.at[0], e.at[1], z])[2] + d;
  };
}

describe("the Titanic's room entries", () => {
  it("are the four rooms in the spec, in order, each with its own picture", () => {
    expect(entries.map((e) => [e.id, e.room, e.icon])).toEqual([
      ["grand-staircase", "gs-boat", "staircase"],
      ["suite", "suite-1", "bed"],
      ["third-class-cabin", "third-cabin", "bunk"],
      ["scotland-road", "scotland-road", "corridor"],
    ]);
    expect(new Set(entries.map((e) => e.icon)).size).toBe(entries.length);
    for (const e of entries) expect(e.label.length).toBeGreaterThan(2);
  });

  it("stand each spot in a walkable room, inside its walls, on a level floor, clear of furniture", () => {
    for (const e of entries) {
      const room = roomOf(e.room);
      expect([e.id, room?.noWalk ?? false]).toEqual([e.id, false]);
      // A level floor: a foyer, cabin or corridor, not a flight.
      expect([e.id, room.ramp]).toEqual([e.id, undefined]);
      expect([e.id, pointInPolygon(e.at, room.outline)]).toEqual([e.id, true]);
      const out = room.outline;
      const nearest = Math.min(
        ...out.map((a, i) => edgeDist(e.at, a, out[(i + 1) % out.length]))
      );
      expect([e.id, nearest > WALK_RADIUS_M]).toEqual([e.id, true]);
      expect([e.id, insideBlocker(map, e.room, e.at, WALK_RADIUS_M)]).toEqual([
        e.id,
        false,
      ]);
      expect(Number.isFinite(e.yaw)).toBe(true);
    }
  });

  it("starts the Grand Staircase facing down the broad flight", () => {
    const gs = entries.find((e) => e.id === "grand-staircase")!;
    const flight = roomOf("gs-flight-boat-a");
    // The flight runs forward from the foyer: facing the bow is down it.
    expect(gs.yaw).toBeCloseTo(0, 6);
    expect(flight.ramp!.from[0]).toBeGreaterThan(gs.at[0]);
  });

  it("only a ship with rooms has entries", () => {
    expect(interiorFor("titanic")?.entries?.length).toBe(4);
    expect(interiorFor("lusitania")).toBeNull();
  });
});

describe("which rooms the picker offers", () => {
  const ctx = (over: Record<string, number>, bodies: BodyPose[] = [LEVEL]) => ({
    map,
    spec: titanic,
    frame: { bodies, water: [] },
    target: waterOver(over),
  });

  it("offers every room while all is dry", () => {
    expect(openEntries(interior, ctx({})).map((e) => e.id)).toEqual(
      entries.map((e) => e.id)
    );
  });

  it("keeps a room with wading water, hides one deeper than that", () => {
    const ids = openEntries(
      interior,
      ctx({
        "scotland-road": WALK_WADE_STOP_M + 0.05,
        "third-cabin": WALK_WADE_STOP_M - 0.3,
      })
    ).map((e) => e.id);
    expect(ids).toEqual(["grand-staircase", "suite", "third-class-cabin"]);
  });

  it("hides every room once she has broken, and before there is a frame", () => {
    const bow = { ...LEVEL, part: "bow" as const };
    const stern = { ...LEVEL, part: "stern" as const };
    expect(openEntries(interior, ctx({}, [bow, stern]))).toEqual([]);
    expect(openEntries(interior, { ...ctx({}), frame: null })).toEqual([]);
  });

  it("offers nothing for an interior without entries", () => {
    expect(openEntries({ ...interior, entries: undefined }, ctx({}))).toEqual(
      []
    );
  });

  describe("on the real night", () => {
    let track: SimTrack;
    const target = roomWaterTargets(titanic);
    const at = (t: number) =>
      openEntries(interior, {
        map,
        spec: titanic,
        frame: sampleTrack(track, t),
        target,
      }).map((e) => e.id);
    beforeAll(() => {
      track = simulate(titanic, titanic.realNight);
    });

    it("offers all four at the start", () => {
      expect(at(0)).toEqual(entries.map((e) => e.id));
    });

    it("loses Scotland Road's forward end to the sea before the staircase", () => {
      const breakT = track.events.find((e) => e.kind === "breakup")!.t;
      let lost: number | null = null;
      for (let t = 0; t < breakT; t += 60) {
        if (!at(t).includes("scotland-road")) {
          lost = t;
          break;
        }
      }
      expect(lost).not.toBeNull();
      expect(at(lost!)).toContain("grand-staircase");
    });

    it("offers none after the break", () => {
      const breakT = track.events.find((e) => e.kind === "breakup")!.t;
      expect(at(breakT + 30)).toEqual([]);
    });
  });
});

describe("the Titanic's walk spawn", () => {
  it("faces the Grand Staircase's starboard door", () => {
    const door = interior.links.find((l) => l.id === "gs-door-starboard")!;
    const [x, y] = TITANIC_WALK.spawn.at;
    const want = Math.atan2(door.from.at[1] - y, door.from.at[0] - x);
    expect(TITANIC_WALK.spawn.area).toBe("boat-deck");
    expect(TITANIC_WALK.spawn.yaw).toBeCloseTo(want, 2);
  });
});

describe("the way from the Titanic's spawn to the door it faces", () => {
  const spawn = TITANIC_WALK.spawn;
  const door = interior.links.find((l) => l.id === "gs-door-starboard")!;
  const deck = map.areas.find((a) => a.id === "boat-deck")!;

  it("is a straight walk crossing no blocker or wall", () => {
    const [x0, y0] = spawn.at;
    const [x1, y1] = door.from.at;
    const len = Math.hypot(x1 - x0, y1 - y0);
    // Clear of the door button's reach at the start, so it is a walk.
    expect(len).toBeGreaterThan(4);
    for (let d = 0; d <= len; d += 0.05) {
      const p: V2 = [
        x0 + Math.cos(spawn.yaw) * d,
        y0 + Math.sin(spawn.yaw) * d,
      ];
      expect([d, pointInPolygon(p, deck.outline)]).toEqual([d, true]);
      expect([d, insideBlocker(map, "boat-deck", p, WALK_RADIUS_M)]).toEqual([
        d,
        false,
      ]);
    }
    // Along the yaw, the far end is the door's outside end.
    expect(x0 + Math.cos(spawn.yaw) * len).toBeCloseTo(x1, 6);
    expect(y0 + Math.sin(spawn.yaw) * len).toBeCloseTo(y1, 6);
  });
});
