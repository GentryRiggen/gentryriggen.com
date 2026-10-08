import type { SimBreakup, SimPhase } from "@/lib/ship-builder/sim/types";
import { isPastBoarding } from "../pastBoarding";

const BREAKUP: SimBreakup = { at: 10, atX: 20, angle: -0.3 };

describe("isPastBoarding", () => {
  it.each<SimPhase>(["sailing", "capsizing", "sinking"])(
    "is false while she is %s and in one piece",
    (phase) => {
      expect(isPastBoarding({ phase, breakup: null })).toBe(false);
    }
  );

  it.each<SimPhase>(["descending", "done"])("is true once %s", (phase) => {
    expect(isPastBoarding({ phase, breakup: null })).toBe(true);
  });

  it.each<SimPhase>(["sailing", "capsizing", "sinking", "descending", "done"])(
    "is true when she has broken, in phase %s",
    (phase) => {
      expect(isPastBoarding({ phase, breakup: BREAKUP })).toBe(true);
    }
  );
});
