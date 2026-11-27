import { SHIP_IDS, specFor } from "../../ships";
import { simulate } from "../run";

/**
 * Any ship in any wreck: every crossover's real run plays to an end
 * without throwing, its frames finite, and ends one of the ways a run can
 * (a sims-lane test: about two minutes for all 42).
 */
const PAIRS = SHIP_IDS.flatMap((ship) =>
  SHIP_IDS.filter((w) => w !== ship).map((wreck) => [ship, wreck] as const)
);

describe("crossover runs", () => {
  it.each(PAIRS)(
    "%s in the %s's wreck plays to an end",
    (ship, wreck) => {
      const spec = specFor(ship, wreck);
      const tr = simulate(spec, spec.realNight, {
        portholesOpen: true,
        storm: "real",
        wave: "real",
      });
      expect(["sank", "floated", "aground", "capsized"]).toContain(tr.outcome);
      expect(tr.frames.length).toBeGreaterThan(10);
      for (const f of tr.frames)
        for (const b of f.bodies) {
          expect(Number.isFinite(b.z)).toBe(true);
          expect(Number.isFinite(b.roll)).toBe(true);
          expect(Number.isFinite(b.pitch)).toBe(true);
        }
      if (tr.outcome === "sank") expect(tr.sankAtT).not.toBeNull();
    },
    120_000
  );

  // Pinned so a change to the crossover rules or a ship shows up here.
  it.each([
    ["titanic", "carpathia", "sank"],
    ["britannic", "titanic", "floated"],
    ["carpathia", "fitzgerald", "sank"],
    ["titanic", "fitzgerald", "floated"],
    ["lusitania", "poseidon", "sank"],
  ] as const)(
    "%s in the %s's wreck %s",
    (ship, wreck, outcome) => {
      const spec = specFor(ship, wreck);
      expect(
        simulate(spec, spec.realNight, { portholesOpen: true }).outcome
      ).toBe(outcome);
    },
    120_000
  );
});
