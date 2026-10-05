import { cardFraming, MIN_CARD_SCALE } from "../cardFraming";

const canvas = { left: 100, top: 50, width: 700, height: 740 };

describe("cardFraming", () => {
  it("does nothing without a card", () => {
    expect(cardFraming(canvas, null)).toBeNull();
    expect(
      cardFraming(canvas, { left: 0, top: 0, width: 0, height: 0 })
    ).toBeNull();
  });

  it("puts the wreck above a card along the bottom of a phone", () => {
    // Full width, covering the bottom three quarters.
    const card = { left: 112, top: 50 + 185, width: 676, height: 543 };
    const framing = cardFraming(canvas, card);
    expect(framing?.x).toBe(350);
    expect(framing?.y).toBeCloseTo((185 - 12) / 2, 5);
    expect(framing?.scale).toBeGreaterThan(MIN_CARD_SCALE);
    expect(framing?.scale).toBeLessThan(1);
  });

  it("uses the side when a narrow, tall card leaves more room there", () => {
    const wide = { left: 0, top: 0, width: 1600, height: 740 };
    const card = { left: 1150, top: 100, width: 448, height: 628 };
    const framing = cardFraming(wide, card);
    expect(framing?.x).toBeCloseTo((1150 - 12) / 2, 5);
    expect(framing?.y).toBe(370);
  });

  it("never shrinks the scene past its floor", () => {
    const card = { left: 100, top: 52, width: 700, height: 736 };
    expect(cardFraming(canvas, card)?.scale).toBe(MIN_CARD_SCALE);
  });
});
