import { lusitania } from "@/lib/shipwreck/ships/lusitania";
import { titanic } from "@/lib/shipwreck/ships/titanic";
import { counterX } from "../buildShip";
import { recipeFor } from "../shipModel";

describe("the name on the counter", () => {
  it.each([
    ["Titanic", titanic],
    ["Lusitania", lusitania],
  ] as const)(
    "%s: the centre line finds the counter, not its tip",
    (_, spec) => {
      const r = recipeFor(spec);
      const board = r.names.find((n) => n.where === "stern")!;
      for (const dz of [-0.5, -0.25, 0, 0.25, 0.5]) {
        const z = board.z + dz * board.height;
        const centre = counterX(r, 0, z);
        // A smooth counter: the centre is where its sides close in, not
        // metres aft at the hull's end (the spike that garbled the name).
        expect(centre).toBeGreaterThan(r.hull.xMin + 1e-3);
        for (const y of [0.25, -0.25])
          expect(Math.abs(counterX(r, y, z) - centre)).toBeLessThan(0.3);
        expect(r.hull.halfBreadth(centre + 0.05, z)).toBeGreaterThan(0);
      }
    }
  );
});
