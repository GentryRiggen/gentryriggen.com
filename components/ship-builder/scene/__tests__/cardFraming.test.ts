import {
  cardEaseAmount,
  cardFraming,
  reachesShip,
  MIN_CARD_SCALE,
} from "../cardFraming";

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

  it("lifts the wreck only by what a slim bottom bar covers", () => {
    // A short, wide bar: 110px tall, 12px off the bottom of the canvas.
    const bar = {
      left: 112,
      top: 50 + 740 - 12 - 110,
      width: 676,
      height: 110,
    };
    const framing = cardFraming(canvas, bar);
    expect(framing?.scale).toBe(1);
    expect(framing?.x).toBe(350);
    // Centred in the clear strip above the bar, not squeezed into a corner.
    expect(framing?.y).toBeCloseTo((740 - 12 - 110 - 12) / 2, 5);
  });

  it("keeps full size beside a centred bar on a wide screen", () => {
    const wide = { left: 0, top: 0, width: 1600, height: 740 };
    const bar = { left: 464, top: 618, width: 672, height: 110 };
    const framing = cardFraming(wide, bar);
    expect(framing?.scale).toBe(1);
    expect(framing?.x).toBe(800);
  });
});

describe("reachesShip", () => {
  const canvas = { left: 0, top: 100, width: 360, height: 600 };

  it("is true when a setup card climbs over the middle of a phone canvas", () => {
    expect(
      reachesShip(canvas, { left: 12, top: 280, width: 336, height: 400 })
    ).toBe(true);
  });

  it("is false for a low card that leaves the ship clear", () => {
    expect(
      reachesShip(canvas, { left: 12, top: 560, width: 336, height: 120 })
    ).toBe(false);
  });

  it("is false without a card", () => {
    expect(reachesShip(canvas, null)).toBe(false);
  });
});

describe("cardEaseAmount", () => {
  it("eases by the frame time on a live clock", () => {
    expect(cardEaseAmount(0.05, false, false)).toBeCloseTo(0.15, 5);
    // A long frame is capped, so one slow frame never snaps it.
    expect(cardEaseAmount(2, false, false)).toBeCloseTo(0.3, 5);
  });

  it("snaps under reduced motion", () => {
    expect(cardEaseAmount(0.016, true, false)).toBe(1);
  });

  it("snaps on a frozen test clock, however slow the frames", () => {
    // A visual test holds a trial after its setup card closes: the framing
    // must be gone in one frame, not eased out over seconds of slow frames.
    expect(cardEaseAmount(0.016, false, true)).toBe(1);
    expect(cardEaseAmount(2, false, true)).toBe(1);
  });
});
