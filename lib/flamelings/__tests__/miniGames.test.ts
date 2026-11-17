import {
  baseLog,
  dropLog,
  LOG_MIN_WIDTH,
  swing,
  swingSpeed,
  type Log,
} from "../logStack";
import {
  BROWN_FROM,
  BURNT_FROM,
  GOLDEN_FROM,
  toastPoints,
  toastStage,
} from "../toast";

describe("toastStage and toastPoints", () => {
  it("goes white, golden, brown, burnt", () => {
    expect(toastStage(0)).toBe("white");
    expect(toastStage(GOLDEN_FROM - 0.01)).toBe("white");
    expect(toastStage(GOLDEN_FROM)).toBe("golden");
    expect(toastStage(BROWN_FROM)).toBe("brown");
    expect(toastStage(BURNT_FROM)).toBe("burnt");
    expect(toastStage(1)).toBe("burnt");
  });

  it("pays the most for golden and always at least a point", () => {
    expect(toastPoints(0.4)).toBe(3);
    expect(toastPoints(0.2)).toBe(2);
    expect(toastPoints(BROWN_FROM + 0.05)).toBe(2);
    expect(toastPoints(0)).toBe(1);
    expect(toastPoints(1)).toBe(1);
  });
});

describe("dropLog", () => {
  const below: Log = { left: 30, width: 40 };

  it("snaps a nearly dead-on drop with no overhang", () => {
    const out = dropLog(below, { left: 32, width: 40 });
    expect(out).toMatchObject({ kind: "land", perfect: true, cutOff: [] });
    if (out.kind === "land") expect(out.log.left).toBe(30);
  });

  it("keeps only what rests on the log below and drops the overhang", () => {
    const out = dropLog(below, { left: 50, width: 40 });
    expect(out.kind).toBe("land");
    if (out.kind !== "land") return;
    expect(out.perfect).toBe(false);
    expect(out.log.width).toBe(20);
    expect(out.log.left).toBe(50);
    expect(out.cutOff).toEqual([{ left: 70, width: 20 }]);
  });

  it("also cuts the left overhang", () => {
    const out = dropLog(below, { left: 15, width: 40 });
    if (out.kind !== "land") throw new Error("should land");
    expect(out.log).toEqual({ left: 30, width: 25 });
    expect(out.cutOff).toEqual([{ left: 15, width: 15 }]);
  });

  it("misses when it does not touch the tower", () => {
    expect(dropLog(below, { left: 75, width: 20 })).toEqual({ kind: "miss" });
    expect(dropLog(below, { left: 0, width: 20 })).toEqual({ kind: "miss" });
  });

  it("never gets thinner than the floor", () => {
    const out = dropLog(below, { left: 68, width: 30 });
    if (out.kind !== "land") throw new Error("should land");
    expect(out.log.width).toBe(LOG_MIN_WIDTH);
  });

  it("starts with a centred base log", () => {
    const base = baseLog();
    expect(base.left + base.width / 2).toBe(50);
  });
});

describe("swing", () => {
  it("bounces off both ends and stays inside", () => {
    let state = { x: 55, dir: 1 as 1 | -1 };
    for (let i = 0; i < 400; i++) {
      state = swing(state.x, state.dir, 40, 60, 0.05);
      expect(state.x).toBeGreaterThanOrEqual(0);
      expect(state.x).toBeLessThanOrEqual(60);
    }
    expect(swing(59, 1, 40, 60, 0.1).dir).toBe(-1);
    expect(swing(1, -1, 40, 60, 0.1).dir).toBe(1);
  });

  it("speeds up with the tower, with a cap", () => {
    expect(swingSpeed(1)).toBeLessThan(swingSpeed(8));
    expect(swingSpeed(99)).toBe(70);
  });
});
