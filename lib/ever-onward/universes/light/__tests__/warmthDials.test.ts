import { meanSlower, playAll } from "./lastSim";
import type { Habit } from "../warmthBots";

/**
 * The last light's one choice (which light goes, and when), played the way a
 * player meets it: every seed is snapshotted when the part begins and played
 * to the flash on the real economy (the real shop, real buying, real prices,
 * no cap), once for each habit. A habit's score is how much longer its
 * crossing takes than the reader's, averaged over 12 seeds (1.05 is five
 * percent slower). The reader sees only what the cards show (flames, hearts,
 * the wind's kind and size); a second reader sees the exact numbers under
 * them.
 */
jest.setTimeout(900_000);

const MARGIN = 1.05;

const ORDERS = ["index", "burn", "company", "ratio"] as const;
/** Fixed orders that start letting go at these times (seconds into the part). */
const STARTS = [240, 300, 360, 450, 600, 750] as const;

const reader = playAll({});
const median = (values: number[]): number =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

describe("the crossing's length and kindness", () => {
  it("finishes every seed, in about twenty minutes for the reader", () => {
    for (const r of reader) expect(r.seconds).toBeLessThan(6000);
    expect(median(reader.map((r) => r.seconds))).toBeGreaterThan(1100);
    expect(median(reader.map((r) => r.seconds))).toBeLessThan(1500);
  });

  it("gets a player who never buys home within about twice the reader's time", () => {
    const noBuys = playAll({}, { buys: false });
    expect(meanSlower(reader, noBuys)).toBeLessThan(2);
    expect(
      Math.max(...noBuys.map((r, i) => r.seconds / reader[i].seconds))
    ).toBeLessThan(2.3);
  });

  it("gets a player who does nothing at all home within about two and a half times", () => {
    // no taps, no shop, no letting go: the lights burn down by themselves
    const idle = playAll(null, { buys: false, taps: 0 });
    expect(meanSlower(reader, idle)).toBeLessThan(2.5);
    expect(
      Math.max(...idle.map((r, i) => r.seconds / reader[i].seconds))
    ).toBeLessThan(2.8);
  });

  it("is cold only a little of the time (never punishing)", () => {
    const cold = reader.reduce((sum, r) => sum + r.cold, 0) / reader.length;
    expect(cold).toBeLessThan(0.1);
  });
});

describe("tapping buys nothing but resolve", () => {
  it("gains a tap-mashing player nothing meaningful over the reader", () => {
    const mash = playAll({}, { taps: 12 });
    const none = playAll({}, { taps: 0 });
    // mashing is at most 3% faster than the reader, and no-taps at most 3% slower
    expect(meanSlower(reader, mash)).toBeGreaterThanOrEqual(0.97);
    expect(meanSlower(reader, none)).toBeLessThanOrEqual(1.03);
  });
});

describe("letting go: reading beats a fixed habit", () => {
  it("finishes sooner than leaving every light to the safety net, by 5%", () => {
    expect(meanSlower(reader, playAll(null))).toBeGreaterThanOrEqual(MARGIN);
  });

  describe.each(ORDERS)("a fixed order (%s)", (order) => {
    it("loses at once", () => {
      expect(
        meanSlower(reader, playAll({ order, after: 0 }))
      ).toBeGreaterThanOrEqual(MARGIN);
    });

    it.each(STARTS)("loses when it starts at %i s", (after) => {
      expect(
        meanSlower(reader, playAll({ order, after }))
      ).toBeGreaterThanOrEqual(MARGIN);
    });
  });

  it("still wins when the reader sees the exact numbers instead of the cards", () => {
    const exact = playAll({ look: "exact" });
    expect(
      meanSlower(exact, playAll({ order: "ratio", after: 0 }))
    ).toBeGreaterThanOrEqual(MARGIN);
    for (const after of [240, 450, 750])
      expect(
        meanSlower(exact, playAll({ order: "ratio", after }))
      ).toBeGreaterThanOrEqual(MARGIN);
    // the cards tell the reader nearly as much as the numbers
    expect(meanSlower(exact, reader)).toBeLessThan(1.03);
    expect(meanSlower(exact, reader)).toBeGreaterThan(0.97);
  });

  it("is worth 5% to read the wind: the reader who ignores it is slower", () => {
    expect(meanSlower(reader, playAll({ wind: false }))).toBeGreaterThanOrEqual(
      MARGIN
    );
  });
});

describe("the habits are real choices", () => {
  const habits: Habit[] = [
    { order: "index" },
    { order: "burn" },
    { order: "company" },
    { order: "ratio" },
  ];
  it("each fixed order plays out differently from the next", () => {
    const times = habits.map((h) =>
      playAll(h)
        .map((r) => Math.round(r.seconds))
        .join(",")
    );
    expect(new Set(times).size).toBe(habits.length);
  });
});
