import { isTap } from "../tapGesture";

describe("isTap", () => {
  it("accepts a still, quick press", () => {
    expect(isTap({ x: 10, y: 10, t: 0 }, { x: 10, y: 10, t: 100 })).toBe(true);
  });
  it("rejects a drag", () => {
    expect(isTap({ x: 0, y: 0, t: 0 }, { x: 9, y: 0, t: 100 })).toBe(false);
  });
  it("rejects a long press", () => {
    expect(isTap({ x: 0, y: 0, t: 0 }, { x: 0, y: 0, t: 450 })).toBe(false);
  });
});
