import {
  FIXED_LINES,
  HABITS,
  STAGES,
  readsTheMarket,
  total,
} from "../coastPlay";

/**
 * Buying oil is a real dial across the whole Coast, wick-2 and the big tanks
 * included. Oil is bought for real (rush orders, tanker deals, the market).
 * A buyer who reads the market beats every habit that does not read the price
 * by 5% or more (2.5% with only the trimmed wick, where oil is the
 * smallest part of the bill), and is never meaningfully beaten by a rigid price line (a
 * fixed line is only the reading rule with the thresholds nailed down).
 */
describe("buying oil is a real dial (oil bought for real)", () => {
  it.each(Object.keys(STAGES))(
    "reading the market beats every habit that ignores the price (%s)",
    (stage) => {
      const read = total(stage, {
        buy: readsTheMarket,
        beam: null,
        toll: "read",
      });
      for (const [name, buy] of Object.entries(HABITS)) {
        if (FIXED_LINES.includes(name)) continue;
        const fixed = total(stage, { buy, beam: null, toll: "read" });
        // With only the trimmed wick the oil bill is small, so the margin there is thinner.
        const margin = stage === "wick-1" ? 1.025 : 1.05;
        expect([name, fixed < read / margin]).toEqual([name, true]);
      }
    },
    300_000
  );

  it.each(Object.keys(STAGES))(
    "is never meaningfully beaten by a rigid price line (%s)",
    (stage) => {
      const read = total(stage, {
        buy: readsTheMarket,
        beam: null,
        toll: "read",
      });
      for (const name of FIXED_LINES) {
        const fixed = total(stage, {
          buy: HABITS[name],
          beam: null,
          toll: "read",
        });
        expect([name, fixed < read * 1.02]).toEqual([name, true]);
      }
    },
    300_000
  );
});
