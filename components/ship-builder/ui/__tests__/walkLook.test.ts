import { lookTurn, LOOK_DEAD_ZONE_PX, LOOK_FULL_TURN_PX } from "../walkLook";

describe("lookTurn", () => {
  it("ignores a drag inside the dead zone", () => {
    expect(lookTurn(0)).toBe(0);
    expect(lookTurn(LOOK_DEAD_ZONE_PX)).toBe(0);
    expect(lookTurn(-LOOK_DEAD_ZONE_PX + 1)).toBe(0);
  });

  it("turns right for a drag right and left for a drag left, mirrored", () => {
    expect(lookTurn(40)).toBeGreaterThan(0);
    expect(lookTurn(-40)).toBe(-lookTurn(40));
  });

  it("reaches full speed at the full-turn offset and stays there", () => {
    expect(lookTurn(LOOK_FULL_TURN_PX)).toBeCloseTo(1);
    expect(lookTurn(LOOK_FULL_TURN_PX * 3)).toBe(1);
    expect(lookTurn(-LOOK_FULL_TURN_PX * 3)).toBe(-1);
  });

  it("is gentler than linear for small drags and always increasing", () => {
    const mid = (LOOK_DEAD_ZONE_PX + LOOK_FULL_TURN_PX) / 2;
    expect(lookTurn(mid)).toBeLessThan(0.5);
    let previous = 0;
    for (let px = LOOK_DEAD_ZONE_PX + 1; px <= LOOK_FULL_TURN_PX; px += 5) {
      expect(lookTurn(px)).toBeGreaterThan(previous);
      previous = lookTurn(px);
    }
  });

  it("treats a non-finite offset as no drag", () => {
    expect(lookTurn(Number.NaN)).toBe(0);
    expect(lookTurn(Infinity)).toBe(0);
  });
});
