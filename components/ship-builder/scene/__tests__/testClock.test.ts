import { testDriveSpeed } from "../testClock";

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
