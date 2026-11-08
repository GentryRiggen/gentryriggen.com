import { simulate, type Strategy } from "../../../engine/sim";
import type { RunState } from "../../../engine/types";
import { BIOMES, blightsSoFar, type Biome } from "../biomes";
import { adjustingPlayer, staticMixPlayer } from "../bots";
import { def, runAtPhaseStart } from "./fixtures";

jest.setTimeout(300_000);

/** Static mixes as [focus kind, jungle, meadow] points: spread out, jungle-light and jungle-heavy. */
const STATIC_MIXES: readonly (readonly [number, number, number])[] = [
  [2, 2, 2],
  [3, 2, 3],
  [4, 2, 2],
  [2, 1, 2],
  [3, 3, 2],
  [4, 4, 2],
  [1, 3, 1],
  [3, 1, 3],
];
const RAIN_STREAMS = [0x1234, 0x5678, 0x9abc];

const worldStart = runAtPhaseStart(2);

/** Seconds the player takes to finish the world, and blights caught, in this weather. */
function inWorld(strategy: Strategy, rain: number) {
  const startRun: RunState = {
    ...worldStart,
    resources: { ...worldStart.resources, wtRng: rain },
  };
  const result = simulate(def, {
    maxSeconds: 4 * 3600,
    step: 1,
    strategy,
    startRun,
    stopWhen: (run) => run.phase >= 3,
  });
  return {
    seconds: result.finalRun.time - startRun.time,
    blights: blightsSoFar(result.finalRun),
  };
}

describe.each([0, 1] as const)("the world mix with fork side %i", (side) => {
  const kinds: Biome[] = [
    side === 0 ? "forest" : "wetland",
    "jungle",
    "meadow",
  ];
  const mixOf = ([a, b, c]: readonly [number, number, number]) =>
    Object.fromEntries(
      BIOMES.map((biome) => [biome, [a, b, c][kinds.indexOf(biome)] ?? 0])
    ) as Record<Biome, number>;

  it("lets no static mix beat a player who adjusts, in any weather", () => {
    for (const rain of RAIN_STREAMS) {
      const adjusting = inWorld(adjustingPlayer(side), rain);
      for (const points of STATIC_MIXES) {
        const fixed = inWorld(staticMixPlayer(mixOf(points), side), rain);
        // Within 3%: the finish is gated by the vault's price, so the best
        // static mixes tie the floor; the worst take far longer.
        expect(adjusting.seconds).toBeLessThanOrEqual(fixed.seconds * 1.03);
      }
    }
  });

  it("keeps a careful player out of the blight", () => {
    for (const rain of RAIN_STREAMS)
      expect(inWorld(adjustingPlayer(side), rain).blights).toBeLessThanOrEqual(
        2
      );
  });
});
