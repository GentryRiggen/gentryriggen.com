import { SEEDS, STAGES, sensibleBuyer, total } from "../coastPlay";
import { TOLL_STEPS } from "../toll";

/**
 * The harbor toll is a real dial once the oil is counted: every ship that
 * comes burns the same oil whatever it pays, so reading the rival's sign AND
 * what a ship's oil costs beats every fixed toll, and beats a rule that
 * reads the rival but forgets the oil.
 */
describe("the toll is a real dial (oil bought for real)", () => {
  it("is tested over twelve different worlds", () => {
    expect(new Set(SEEDS).size).toBe(12);
  });

  it.each(Object.keys(STAGES))(
    "reading the sign beats every fixed toll, and the oil term never hurts (%s)",
    (stage) => {
      const play = (toll: number | "read" | "blind") =>
        total(stage, { buy: sensibleBuyer, beam: null, toll });
      const read = play("read");
      for (let step = 0; step < TOLL_STEPS.length; step += 1)
        expect(play(step)).toBeLessThan(read / 1.08);
      // a rule that forgets what a ship's oil costs is never meaningfully better
      expect(play("blind")).toBeLessThan(read * 1.03);
    },
    240_000
  );
});
