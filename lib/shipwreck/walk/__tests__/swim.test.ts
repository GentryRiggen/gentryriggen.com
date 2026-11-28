import { concordia } from "../../ships/concordia";
import { titanic } from "../../ships/titanic";
import { sampleTrack, simulate, type SimTrack } from "../../sim";
import type { BodyPose, SimFrame } from "../../sim/track";
import { CONCORDIA_WALK } from "../concordiaDecks";
import { shipToEarth } from "../slope";
import type { WalkerState, WalkInput } from "../step";
import {
  canReboard,
  hullClearanceM,
  type HullPiece,
  placeWalker,
  stepSwimmer,
  SWIM_SPEED_MS,
  swimmerFrom,
  type SwimmerState,
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

describe("the swimmer and her superstructure (the Concordia lying over)", () => {
  // At rest at 65°, her top tier's side lies in the sea to starboard.
  const lying = pose({ z: -concordia.draught, roll: 65 * DEG });
  const boxes = concordia.superstructure;
  /** Paddling straight at her from 110 m off her low side, for 70 s. */
  function paddle(piece: HullPiece): SwimmerState[] {
    let s: SwimmerState = { x: 0, y: -110, yaw: Math.PI / 2 };
    const out: SwimmerState[] = [];
    for (let i = 0; i < 60 * 70; i += 1) {
      s = stepSwimmer(s, FORWARD, 1 / 60, [piece]);
      out.push(s);
    }
    return out;
  }

  it("is held clear of her superstructure's boxes", () => {
    const withBoxes: HullPiece = {
      pose: lying,
      spec: concordia,
      superstructure: boxes,
    };
    const path = paddle(withBoxes);
    let worst = Infinity;
    for (const s of path)
      worst = Math.min(worst, hullClearanceM(s.x, s.y, [withBoxes]));
    expect(worst).toBeGreaterThanOrEqual(0);
    // It did reach her: within a metre of her side.
    expect(worst).toBeLessThan(1);
  });

  it("without them, paddles as before (into the boxes)", () => {
    const plain: HullPiece = { pose: lying, spec: concordia };
    const path = paddle(plain);
    expect(paddle({ ...plain, superstructure: undefined })).toEqual(path);
    const withBoxes = [{ ...plain, superstructure: boxes }];
    // Clear of her hull, but somewhere inside a box.
    for (const s of path)
      expect(hullClearanceM(s.x, s.y, [plain])).toBeGreaterThanOrEqual(0);
    expect(
      Math.min(...path.map((s) => hullClearanceM(s.x, s.y, withBoxes)))
    ).toBeLessThan(0);
  });
});

describe("where walking her ends (the Concordia at 40°)", () => {
  const her = CONCORDIA_WALK;
  const frameAt = (listDeg: number) =>
    ({
      bodies: [pose({ z: -concordia.draught, roll: listDeg * DEG })],
      listDeg,
    }) as unknown as SimFrame;

  it("places nobody on her from 40° of list either way", () => {
    expect(her.walkEndsAtHeelDeg).toBe(40);
    expect(placeWalker(her, concordia, frameAt(39.9), null)).not.toBeNull();
    expect(placeWalker(her, concordia, frameAt(40), null)).toBeNull();
    expect(placeWalker(her, concordia, frameAt(-40.1), null)).toBeNull();
    expect(canReboard(her, concordia, frameAt(40.1), null)).toBe(false);
    // Without the flag, the spawn's dryness alone decides, as before.
    const plain = { ...her, walkEndsAtHeelDeg: undefined };
    expect(placeWalker(plain, concordia, frameAt(40.1), null)).not.toBeNull();
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
  walkInput.jump = true;
  resetWalkInput();
  expect(walkInput).toEqual({
    forward: 0,
    strafe: 0,
    lookDx: 0,
    lookDy: 0,
    jump: false,
  });
});
