import { WARMTH_S } from "@/lib/ship-builder/walk/escape";
import { testDriveSpeed, testEscapeWarmthSeconds } from "../testClock";

afterEach(() => {
  delete window.__SHIP_BUILDER_TEST__;
});

describe("testDriveSpeed", () => {
  it("is 1 when no test sets it", () => {
    expect(testDriveSpeed()).toBe(1);
  });

  it("returns the speed a test sets", () => {
    window.__SHIP_BUILDER_TEST__ = { driveSpeed: 10 };
    expect(testDriveSpeed()).toBe(10);
  });

  it("ignores speeds that are zero, negative or not finite", () => {
    for (const driveSpeed of [0, -2, Number.NaN, Infinity]) {
      window.__SHIP_BUILDER_TEST__ = { driveSpeed };
      expect(testDriveSpeed()).toBe(1);
    }
  });
});

describe("testEscapeWarmthSeconds", () => {
  it("is the usual warmth when no test sets it", () => {
    expect(testEscapeWarmthSeconds()).toBe(WARMTH_S);
  });

  it("returns the seconds a test sets, ignoring nonsense", () => {
    window.__SHIP_BUILDER_TEST__ = { escapeWarmthSeconds: 3 };
    expect(testEscapeWarmthSeconds()).toBe(3);
    for (const escapeWarmthSeconds of [0, -1, Number.NaN]) {
      window.__SHIP_BUILDER_TEST__ = { escapeWarmthSeconds };
      expect(testEscapeWarmthSeconds()).toBe(WARMTH_S);
    }
  });
});
