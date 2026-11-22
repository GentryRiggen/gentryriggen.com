import { titanic } from "../../ships/titanic";
import { sampleTrack, simulate, type SimTrack } from "../../sim";
import type { BodyPose } from "../../sim/track";
import { shipToEarth } from "../slope";
import type { WalkerState, WalkInput } from "../step";
import {
  canReboard,
  hullClearanceM,
  placeWalker,
  stepSwimmer,
  SWIM_SPEED_MS,
  swimmerFrom,
} from "../swim";
import { resetWalkInput, walkInput } from "../walkInput";
import { floorZ, TITANIC_WALK, type WalkMap } from "..";

const DEG = Math.PI / 180;
const map = TITANIC_WALK;
const spec = titanic;
const STILL: WalkInput = { forward: 0, strafe: 0, lookDx: 0, lookDy: 0 };
const FORWARD: WalkInput = { ...STILL, forward: 1 };

function pose(p: Partial<BodyPose> = {}): BodyPose {
  return {
    part: "whole",
    x: 0,
    y: 0,
    z: -9.83,
    pitch: 0,
    roll: 0,
    yaw: 0,
    ...p,
  };
}

describe("the swimmer", () => {
  it("paddles at 2 m/s", () => {
    let s = { x: 0, y: -100, yaw: Math.PI };
    for (let i = 0; i < 600; i += 1)
      s = stepSwimmer(s, FORWARD, 1 / 60, [{ pose: pose(), spec }]);
    expect(SWIM_SPEED_MS).toBe(2);
    expect(Math.abs(Math.hypot(s.x, s.y + 100) - 20)).toBeLessThan(0.5);
    expect(s.x).toBeLessThan(-19.5);
  });

  it("turns with the look drag", () => {
    const s = stepSwimmer(
      { x: 0, y: -100, yaw: 0 },
      { ...STILL, lookDx: 100 },
      1 / 60,
      []
    );
    expect(s.yaw).toBeCloseTo(-0.5, 9);
  });

  it("cannot paddle into her hull", () => {
    const hull = [{ pose: pose({ roll: 10 * DEG, yaw: 0.3 }), spec }];
    let s = { x: 0, y: -40, yaw: Math.PI / 2 };
    for (let i = 0; i < 60 * 90; i += 1) {
      s = stepSwimmer(
        s,
        { ...FORWARD, strafe: i % 200 < 100 ? 0.3 : -0.3 },
        1 / 60,
        hull
      );
      expect(hullClearanceM(s.x, s.y, hull)).toBeGreaterThanOrEqual(0);
    }
  });

  it("can paddle under a part held clear of the sea", () => {
    // Her stern high in the air: nothing of her at the surface here.
    const hull = [{ pose: pose({ z: 60 }), spec }];
    expect(hullClearanceM(0, 0, hull)).toBe(Infinity);
  });

  it("lands 3 m clear of the hull from the deck", () => {
    for (const p of [
      pose(),
      pose({ roll: 25 * DEG }),
      pose({ pitch: 15 * DEG, roll: -12 * DEG, yaw: 1 }),
    ]) {
      for (const y of [-13.8, 13.8, 0]) {
        const w: WalkerState = {
          part: "whole",
          area: "boat-deck",
          x: 10,
          y,
          yaw: 0,
        };
        const s = swimmerFrom(w, p, spec, map);
        expect(
          hullClearanceM(s.x, s.y, [{ pose: p, spec }])
        ).toBeGreaterThanOrEqual(3 - 1e-6);
        // Near where they went in.
        const feet = shipToEarth(p, [w.x, w.y, floorZ(map, w.area, w.x, spec)]);
        expect(Math.hypot(s.x - feet[0], s.y - feet[1])).toBeLessThan(40);
      }
    }
  });
});

describe("placing the walker on the real night", () => {
  let track: SimTrack;
  beforeAll(() => {
    track = simulate(titanic, titanic.realNight);
  });

  it("stands them on the boat deck at the start", () => {
    const w = placeWalker(map, spec, sampleTrack(track, 0), track.breakX);
    expect(w).toMatchObject({
      part: "whole",
      area: "boat-deck",
      x: map.spawn.at[0],
      y: map.spawn.at[1],
      yaw: map.spawn.yaw,
    });
    expect(canReboard(map, spec, sampleTrack(track, 0), track.breakX)).toBe(
      true
    );
  });

  it("has nowhere to stand once she has gone", () => {
    const f = sampleTrack(track, (track.sankAtT as number) + 30);
    expect(placeWalker(map, spec, f, track.breakX)).toBeNull();
    expect(canReboard(map, spec, f, track.breakX)).toBe(false);
  });

  it("needs the spawn dry by a knee's depth on the real sea", () => {
    const f = sampleTrack(track, 0);
    const pose0 = f.bodies[0];
    const [, , fz] = shipToEarth(pose0, [
      map.spawn.at[0],
      map.spawn.at[1],
      floorZ(map, map.spawn.area, map.spawn.at[0], spec),
    ]);
    // The sea 0.4 m under the feet: too close to stand.
    const near = () => fz - 0.4;
    expect(placeWalker(map, spec, f, track.breakX, near)).toBeNull();
    expect(canReboard(map, spec, f, track.breakX, near)).toBe(false);
    // 0.6 m under: room to stand.
    const clear = () => fz - 0.6;
    expect(placeWalker(map, spec, f, track.breakX, clear)).not.toBeNull();
  });

  it("puts them on the part their spawn is on after the break", () => {
    const breakX = track.breakX as number;
    const f = sampleTrack(track, (track.brokeAtT as number) + 1);
    expect(f.bodies.map((b) => b.part).sort()).toEqual(["bow", "stern"]);
    const moved = (x: number): WalkMap => ({
      ...map,
      spawn: { ...map.spawn, at: [x, map.spawn.at[1]] },
    });
    expect(placeWalker(moved(breakX - 15), spec, f, breakX)?.part).toBe(
      "stern"
    );
    expect(placeWalker(moved(breakX + 15), spec, f, breakX)?.part).toBe("bow");
    expect(placeWalker(map, spec, f, breakX)?.part).toBe(
      map.spawn.at[0] >= breakX ? "bow" : "stern"
    );
  });
});

it("resets the shared walk input", () => {
  walkInput.forward = 1;
  walkInput.strafe = -1;
  walkInput.lookDx = 30;
  walkInput.lookDy = -4;
  resetWalkInput();
  expect(walkInput).toEqual({ forward: 0, strafe: 0, lookDx: 0, lookDy: 0 });
});
