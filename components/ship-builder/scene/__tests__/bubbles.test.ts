import {
  BUBBLE_MAX,
  bubbleCapacity,
  bubbleState,
  createBubbleState,
} from "../bubbles";

describe("bubbleState", () => {
  const out = createBubbleState();

  it("is invisible when born and when it pops", () => {
    expect(bubbleState(0, 2, out).alpha).toBe(0);
    expect(bubbleState(1, 2, out).alpha).toBe(0);
  });

  it("is visible mid-life", () => {
    expect(bubbleState(0.4, 2, out).alpha).toBeGreaterThan(0.3);
  });

  it("streams aft and rises as it ages", () => {
    const young = { ...bubbleState(0.2, 2, out) };
    const old = { ...bubbleState(0.8, 2, out) };
    expect(old.aft).toBeGreaterThan(young.aft);
    expect(old.rise).toBeGreaterThan(young.rise);
  });

  it("streams further behind a faster propeller", () => {
    const slow = bubbleState(0.5, 0.5, out).aft;
    expect(bubbleState(0.5, 3, out).aft).toBeGreaterThan(slow);
  });
});

describe("bubbleCapacity", () => {
  it("allots 12 bubbles per propeller", () => {
    expect(bubbleCapacity(2)).toBe(24);
    expect(bubbleCapacity(0)).toBe(0);
  });

  it("is capped at 200", () => {
    expect(bubbleCapacity(100)).toBe(BUBBLE_MAX);
  });
});
