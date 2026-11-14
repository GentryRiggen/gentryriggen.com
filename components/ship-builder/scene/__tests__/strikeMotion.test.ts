import { ICEBERG_IMPACT_S } from "@/lib/ship-builder/sim/flooding";
import {
  approachLeft,
  blastPiecePose,
  isMineGone,
  leverOf,
  PIECE_GONE_Y,
  SLIDE_OFF_S,
  strikePose,
  strikeRest,
  struckEnd,
  type PiecePose,
  type StrikePose,
} from "../strikeMotion";

const LENGTH = 30;
const BEAM = 4;
const pose = (): StrikePose => ({ y: 0, roll: 0, pitch: 0 });
const piece = (): PiecePose => ({
  x: 0,
  y: 0,
  z: 0,
  rx: 0,
  ry: 0,
  rz: 0,
  visible: false,
});

describe("where she was struck", () => {
  it("tells the bow, the side and the stern apart", () => {
    expect(struckEnd(0, LENGTH)).toBe("bow");
    expect(struckEnd(12, LENGTH)).toBe("side");
    expect(struckEnd(LENGTH, LENGTH)).toBe("stern");
  });

  it("levers +1 at the bow, 0 amidships, -1 at the stern", () => {
    expect(leverOf(0, LENGTH)).toBe(1);
    expect(leverOf(LENGTH / 2, LENGTH)).toBe(0);
    expect(leverOf(LENGTH, LENGTH)).toBe(-1);
  });

  it("puts a bow island ahead of her and a side island to starboard", () => {
    const bow = strikeRest("island", 0, LENGTH, BEAM);
    expect(bow.x).toBeGreaterThan(LENGTH / 2);
    expect(bow.z).toBe(0);
    const side = strikeRest("island", 12, LENGTH, BEAM);
    expect(side.x).toBeCloseTo(LENGTH / 2 - 12);
    expect(side.z).toBeGreaterThan(BEAM / 2);
    const stern = strikeRest("mine", LENGTH, LENGTH, BEAM);
    expect(stern.x).toBeLessThan(-LENGTH / 2);
  });
});

describe("strikePose", () => {
  it("adds nothing before the strike or for an iceberg", () => {
    expect(strikePose("mine", 0, LENGTH, 1, null, pose())).toEqual(pose());
    expect(
      strikePose("iceberg", 0, LENGTH, ICEBERG_IMPACT_S + 1, null, pose())
    ).toEqual(pose());
  });

  it("a mine heaves her up, then she settles", () => {
    const jolt = strikePose("mine", 0, LENGTH, ICEBERG_IMPACT_S, null, pose());
    expect(jolt.y).toBeGreaterThan(0.3);
    const later = strikePose(
      "mine",
      0,
      LENGTH,
      ICEBERG_IMPACT_S + 5,
      null,
      pose()
    );
    expect(Math.abs(later.y)).toBeLessThan(0.01);
    expect(Math.abs(later.pitch)).toBeLessThan(0.01);
  });

  it("an island at the bow lifts the bow and holds it", () => {
    const perched = strikePose(
      "island",
      0,
      LENGTH,
      ICEBERG_IMPACT_S + 3,
      null,
      pose()
    );
    expect(perched.pitch).toBeGreaterThan(0.05);
    expect(perched.y).toBeGreaterThan(0);
  });

  it("an island at the stern lifts the stern", () => {
    const perched = strikePose(
      "island",
      LENGTH,
      LENGTH,
      ICEBERG_IMPACT_S + 3,
      null,
      pose()
    );
    expect(perched.pitch).toBeLessThan(-0.05);
  });

  it("an island to starboard heels her away from it", () => {
    const perched = strikePose(
      "island",
      12,
      LENGTH,
      ICEBERG_IMPACT_S + 3,
      null,
      pose()
    );
    expect(perched.roll).toBeLessThan(-0.05);
  });

  it("she slides off the rocks once she starts to sink", () => {
    const sinkingAt = ICEBERG_IMPACT_S + 5;
    const slid = strikePose(
      "island",
      0,
      LENGTH,
      sinkingAt + SLIDE_OFF_S,
      sinkingAt,
      pose()
    );
    expect(Math.abs(slid.pitch)).toBeLessThan(0.001);
    expect(slid.y).toBeCloseTo(0);
  });
});

describe("approach", () => {
  it("closes in and meets her at the strike", () => {
    expect(approachLeft(0)).toBeGreaterThan(approachLeft(1));
    expect(approachLeft(ICEBERG_IMPACT_S)).toBe(0);
    expect(approachLeft(ICEBERG_IMPACT_S + 10)).toBe(0);
  });

  it("the mine is gone once it goes off", () => {
    expect(isMineGone(ICEBERG_IMPACT_S - 0.01)).toBe(false);
    expect(isMineGone(ICEBERG_IMPACT_S)).toBe(true);
  });
});

describe("blastPiecePose", () => {
  const from = { x: 2, y: 2.2, z: 1 };

  it("starts where the part sat", () => {
    const at = blastPiecePose(0, from, 0, 0, 0, piece());
    expect(at).toMatchObject({ x: 2, y: 2.2, z: 1, visible: true });
  });

  it("flies up and away from the blast", () => {
    const at = blastPiecePose(3, from, 0, 0, 0.3, piece());
    expect(at.y).toBeGreaterThan(from.y);
    expect(at.x).toBeGreaterThan(from.x - 1);
  });

  it("lands, floats, then sinks out of sight", () => {
    expect(blastPiecePose(1, from, 0, 0, 3, piece()).y).toBeLessThan(0);
    const gone = blastPiecePose(1, from, 0, 0, 60, piece());
    expect(gone.y).toBeLessThan(PIECE_GONE_Y);
    expect(gone.visible).toBe(false);
  });

  it("is the same at the same moment (scrubbing)", () => {
    expect(blastPiecePose(5, from, 0, 0, 1.3, piece())).toEqual(
      blastPiecePose(5, from, 0, 0, 1.3, piece())
    );
  });
});
