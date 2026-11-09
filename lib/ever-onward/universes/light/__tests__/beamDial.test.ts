import { HABITS, STAGES, sensibleBuyer, total } from "../coastPlay";
import { BEAM_STEPS } from "../beam";

/**
 * The lamp's brightness is a real dial across the whole Coast: the best step
 * moves with the oil price, so no fixed step wins, whatever the player buys
 * (a tanker-filler, a cheap-hunter, a top-up habit) and whatever they own.
 */
describe("the lamp's brightness is a real dial (oil bought for real)", () => {
  const buyers = {
    "a sensible buyer": sensibleBuyer,
    "a tanker-filler": HABITS["tanker, or an emergency under 5%"],
    "a top-up habit": HABITS["tops up under a quarter"],
  };

  it.each(Object.keys(STAGES))(
    "reading the price beats every fixed step by 5% or more (%s)",
    (stage) => {
      for (const [name, buy] of Object.entries(buyers)) {
        const read = total(stage, { buy, beam: null, toll: "read" });
        for (let step = 0; step < BEAM_STEPS.length; step += 1) {
          const fixed = total(stage, { buy, beam: step, toll: "read" });
          expect([name, step, fixed < read / 1.05]).toEqual([name, step, true]);
        }
      }
    },
    300_000
  );
});
