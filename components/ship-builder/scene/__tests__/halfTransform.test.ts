import { Euler, Matrix4, Object3D, Vector3 } from "three";
import type { HalfPose } from "@/lib/ship-builder/sim/types";
import {
  applyBobCarry,
  applyHalfPose,
  BOB_HANDOFF_S,
  bobCarryWeight,
  breakOrigin,
  halfMatrix,
  worldXOf,
} from "../halfTransform";

const LENGTH = 30;

/** The whole ship's group: rotation (roll, 0, pitch), then down by sink. */
function wholeShipMatrix(roll: number, pitch: number, sink: number): Matrix4 {
  return new Matrix4()
    .makeRotationFromEuler(new Euler(roll, 0, pitch))
    .setPosition(0, -sink, 0);
}

/** The contract's continuity values for a half pivoting at `atX`. */
function continuousHalf(atX: number, pitch: number, sink: number): HalfPose {
  const px = worldXOf(atX, LENGTH);
  return {
    roll: 0,
    pitch,
    pivotX: atX,
    driftX: px * (Math.cos(pitch) - 1),
    sink: sink - px * Math.sin(pitch),
  };
}

const SAMPLE_POINTS = [
  new Vector3(LENGTH / 2, 0.8, 0.4), // bow tip
  new Vector3(-LENGTH / 2, -1.2, -1.5), // stern tip
  new Vector3(worldXOf(18, LENGTH), 1.2, 2), // on the break line
  new Vector3(3, -0.5, 0),
];

describe("worldXOf", () => {
  it("puts the bow at +x and the stern at -x", () => {
    expect(worldXOf(0, LENGTH)).toBe(15);
    expect(worldXOf(LENGTH, LENGTH)).toBe(-15);
  });
});

describe("halfMatrix", () => {
  it("matches the contract formula T(drift, -sink) T(px) R T(-px)", () => {
    const pose: HalfPose = {
      roll: 0.2,
      pitch: -0.3,
      sink: 2,
      pivotX: 12,
      driftX: 0.7,
    };
    const px = worldXOf(pose.pivotX, LENGTH);
    const expected = new Matrix4()
      .makeTranslation(pose.driftX, -pose.sink, 0)
      .multiply(new Matrix4().makeTranslation(px, 0, 0))
      .multiply(
        new Matrix4().makeRotationFromEuler(new Euler(pose.roll, 0, pose.pitch))
      )
      .multiply(new Matrix4().makeTranslation(-px, 0, 0));
    const actual = halfMatrix(pose, LENGTH);
    actual.elements.forEach((value, i) =>
      expect(value).toBeCloseTo(expected.elements[i], 10)
    );
  });

  it.each([
    [18, -0.33, 1.4],
    [10, -0.1, 0.2],
    [22, 0.25, 3],
  ])(
    "a half pivoting at %d with the continuity values sits where the whole ship was",
    (atX, pitch, sink) => {
      const whole = wholeShipMatrix(0, pitch, sink);
      const half = halfMatrix(continuousHalf(atX, pitch, sink), LENGTH);
      for (const point of SAMPLE_POINTS) {
        const a = point.clone().applyMatrix4(whole);
        const b = point.clone().applyMatrix4(half);
        expect(b.distanceTo(a)).toBeLessThan(1e-9);
      }
    }
  );
});

describe("applyHalfPose", () => {
  it("gives an object the same placement as halfMatrix", () => {
    const pose: HalfPose = {
      roll: -0.15,
      pitch: 0.9,
      sink: 5,
      pivotX: 20,
      driftX: -1.2,
    };
    const object = applyHalfPose(new Object3D(), pose, LENGTH);
    object.updateMatrix();
    const expected = halfMatrix(pose, LENGTH);
    for (const point of SAMPLE_POINTS) {
      const a = point.clone().applyMatrix4(object.matrix);
      const b = point.clone().applyMatrix4(expected);
      expect(a.distanceTo(b)).toBeLessThan(1e-9);
    }
  });

  it("leaves a level, unsunk half where it started", () => {
    const object = applyHalfPose(
      new Object3D(),
      { roll: 0, pitch: 0, sink: 0, pivotX: 9, driftX: 0 },
      LENGTH
    );
    expect(object.position.length()).toBeCloseTo(0, 12);
    expect(object.rotation.z).toBe(0);
  });
});

describe("breakOrigin", () => {
  it("is where both halves had their broken ends at the break", () => {
    const [atX, pitch, sink] = [18, -0.3, 3.6];
    const origin = breakOrigin(atX, LENGTH, pitch, sink, new Vector3());
    const onKeel = new Vector3(worldXOf(atX, LENGTH), 0, 0);
    const half = halfMatrix(continuousHalf(atX, pitch, sink), LENGTH);
    expect(onKeel.applyMatrix4(half).distanceTo(origin)).toBeLessThan(1e-9);
  });
});

describe("bob carry", () => {
  it("hands the bob over from all at the break to none", () => {
    expect(bobCarryWeight(-0.1)).toBe(0);
    expect(bobCarryWeight(0)).toBe(1);
    expect(bobCarryWeight(BOB_HANDOFF_S / 2)).toBeCloseTo(0.5, 10);
    expect(bobCarryWeight(BOB_HANDOFF_S)).toBe(0);
    expect(bobCarryWeight(BOB_HANDOFF_S * 4)).toBe(0);
  });

  it("puts a half carrying the bob where the bobbing whole ship was", () => {
    // The whole ship's group adds the idle bob: up by `lift`, pitched by
    // `bobPitch` on top of the sim's pitch, all about her own origin.
    const [lift, bobPitch, pitch, sink, atX] = [0.18, 0.02, -0.3, 3.6, 18];
    const whole = wholeShipMatrix(0, pitch + bobPitch, sink - lift);
    const carry = applyBobCarry(new Object3D(), lift, bobPitch, -sink);
    carry.updateMatrix();
    const half = carry.matrix
      .clone()
      .multiply(halfMatrix(continuousHalf(atX, pitch, sink), LENGTH));
    for (const point of SAMPLE_POINTS) {
      const a = point.clone().applyMatrix4(whole);
      const b = point.clone().applyMatrix4(half);
      expect(b.distanceTo(a)).toBeLessThan(1e-9);
    }
  });

  it("does nothing with no bob", () => {
    const carry = applyBobCarry(new Object3D(), 0, 0, -5);
    expect(carry.position.length()).toBe(0);
    expect(carry.rotation.z).toBe(0);
  });
});
