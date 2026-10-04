// three ships as ESM, which Jest can't load; plain stand-ins with the same
// lerp, copy and equals behaviour are enough to pin the easing down.
jest.mock("three", () => {
  class Color {
    hex: number;
    constructor(hex: string | number = 0) {
      this.hex = typeof hex === "string" ? parseInt(hex.slice(1), 16) : hex;
    }
    lerp(other: Color, amount: number) {
      this.hex += (other.hex - this.hex) * amount;
      return this;
    }
    equals(other: Color) {
      return this.hex === other.hex;
    }
  }
  class Vector3 {
    constructor(
      public x = 0,
      public y = 0,
      public z = 0
    ) {}
    lerp(other: Vector3, amount: number) {
      this.x += (other.x - this.x) * amount;
      this.y += (other.y - this.y) * amount;
      this.z += (other.z - this.z) * amount;
      return this;
    }
  }
  return { Color, Vector3 };
});

import { environmentFor } from "../environmentModel";
import { easeEnvironment, toRuntimeEnvironment } from "../environmentRuntime";

describe("easeEnvironment", () => {
  const day = environmentFor("day", "calm");
  const night = environmentFor("night", "stormy");

  it("moves part of the way toward the target", () => {
    const current = toRuntimeEnvironment(day);
    easeEnvironment(current, toRuntimeEnvironment(night), 0.5);
    const { lightIntensity } = current.numbers;
    expect(lightIntensity).toBeLessThan(day.numbers.lightIntensity);
    expect(lightIntensity).toBeGreaterThan(night.numbers.lightIntensity);
    expect(current.vectors.lightPosition.y).toBeLessThan(40);
  });

  it("lands on the target and then stays there", () => {
    const current = toRuntimeEnvironment(day);
    const target = toRuntimeEnvironment(night);
    const expectNumbersAtTarget = () => {
      for (const [key, value] of Object.entries(target.numbers)) {
        expect(
          current.numbers[key as keyof typeof current.numbers]
        ).toBeCloseTo(value, 9);
      }
    };
    easeEnvironment(current, target, 1);
    expectNumbersAtTarget();
    expect(current.colors.skyZenith.equals(target.colors.skyZenith)).toBe(true);
    easeEnvironment(current, target, 0.3);
    expectNumbersAtTarget();
  });

  it("leaves the target untouched", () => {
    const target = toRuntimeEnvironment(night);
    const before = target.numbers.cloudCover;
    easeEnvironment(toRuntimeEnvironment(day), target, 0.5);
    expect(target.numbers.cloudCover).toBe(before);
  });
});
