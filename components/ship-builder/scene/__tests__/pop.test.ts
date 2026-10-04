import { popScale, POP_DURATION, singleAddedId } from "../pop";

describe("popScale", () => {
  it("starts at 0.6", () => {
    expect(popScale(0)).toBeCloseTo(0.6);
  });

  it("settles on exactly 1 once the pop is over", () => {
    expect(popScale(POP_DURATION)).toBeCloseTo(1);
    expect(popScale(5)).toBe(1);
  });

  it("overshoots 1 slightly on the way", () => {
    let peak = 0;
    for (let t = 0; t <= POP_DURATION; t += 0.005) {
      peak = Math.max(peak, popScale(t));
    }
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThan(1.1);
  });

  it("clamps negative time to the start scale", () => {
    expect(popScale(-1)).toBeCloseTo(0.6);
  });
});

describe("singleAddedId", () => {
  const parts = (...ids: string[]) => ids.map((id) => ({ id }));

  it("returns the one new id", () => {
    expect(singleAddedId(parts("a"), parts("a", "b"))).toBe("b");
  });

  it("returns null when nothing was added", () => {
    expect(singleAddedId(parts("a", "b"), parts("a"))).toBeNull();
    expect(singleAddedId(parts("a"), parts("a"))).toBeNull();
  });

  it("returns null for a batch, such as a loaded ship or a bulk undo", () => {
    expect(singleAddedId(parts(), parts("a", "b"))).toBeNull();
    expect(singleAddedId(parts("a"), parts("b", "c"))).toBeNull();
  });
});
