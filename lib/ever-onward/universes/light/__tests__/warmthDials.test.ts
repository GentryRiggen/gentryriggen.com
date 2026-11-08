import { meanSlower, playAll } from "./lastSim";
import type { Habit } from "../warmthBots";

/**
 * The last light's one choice (which light goes, and when), played the way a
 * player meets it: every seed is snapshotted when the part begins and played
 * to the flash on the real economy (the real shop, real buying, real prices),
 * once for each habit. A habit's score is how much longer its crossing takes
 * than the reader's, averaged over 12 seeds (1.05 is five percent slower).
 */
jest.setTimeout(900_000);

const MARGIN = 1.05;
/**
 * The best plain rule there is (the least company per warmth first, held for
 * five to ten minutes, which a player only finds by reading the cards and
 * trying) sits closer: the reader beats it by about 4%.
 */
const TUNED_MARGIN = 1.03;

/** The plain rules a player might fall into: a fixed order from the start. */
const RULES: readonly (readonly [string, Habit])[] = [
  ["the nearest first, at once", { order: "index", after: 0 }],
  ["the heaviest first, at once", { order: "burn", after: 0 }],
  ["the least company per warmth first, at once", { order: "ratio", after: 0 }],
  ["the heaviest first, after 10 minutes", { order: "burn", after: 600 }],
  ["the nearest first, after 10 minutes", { order: "index", after: 600 }],
  [
    "the least company per warmth first, after 15 minutes",
    { order: "ratio", after: 900 },
  ],
];

/** The tuned rules: the best order, held back for a while. */
const TUNED: readonly (readonly [string, Habit])[] = [
  [
    "the least company per warmth first, after 5 minutes",
    { order: "ratio", after: 300 },
  ],
  [
    "the least company per warmth first, after 7 minutes",
    { order: "ratio", after: 450 },
  ],
  [
    "the least company per warmth first, after 10 minutes",
    { order: "ratio", after: 600 },
  ],
];

describe("letting go: reading beats a fixed habit", () => {
  const reader = playAll({});

  it("finishes every seed", () => {
    for (const r of reader) expect(r.seconds).toBeLessThan(6000);
  });

  it("beats keeping every light burning by 5%", () => {
    expect(meanSlower(reader, playAll(null))).toBeGreaterThanOrEqual(MARGIN);
  });

  it.each(RULES)("beats a plain rule: %s", (_name, habit) => {
    expect(meanSlower(reader, playAll(habit))).toBeGreaterThanOrEqual(MARGIN);
  });

  it.each(TUNED)("stays ahead of a tuned rule: %s", (_name, habit) => {
    expect(meanSlower(reader, playAll(habit))).toBeGreaterThanOrEqual(
      TUNED_MARGIN
    );
  });

  it("beats the reader who ignores the trip left by 5%", () => {
    expect(meanSlower(reader, playAll({ trip: false }))).toBeGreaterThanOrEqual(
      MARGIN
    );
  });

  it("beats cupping the flame against every wind by 3% (a wind is only worth it when it is big and the lights are many)", () => {
    expect(
      meanSlower(reader, playAll({ shelter: "always" }))
    ).toBeGreaterThanOrEqual(TUNED_MARGIN);
  });

  it("is not the same on every seed: the best rule moves with the run", () => {
    const rules = [...RULES, ...TUNED].map(([, habit]) => playAll(habit));
    const bestRule = reader.map((_, seed) =>
      rules.reduce(
        (best, run, i) =>
          run[seed].seconds < rules[best][seed].seconds ? i : best,
        0
      )
    );
    expect(new Set(bestRule).size).toBeGreaterThanOrEqual(3);
  });

  it("is cold only a little of the time (never punishing)", () => {
    const cold = reader.reduce((sum, r) => sum + r.cold, 0) / reader.length;
    expect(cold).toBeLessThan(0.1);
  });
});
