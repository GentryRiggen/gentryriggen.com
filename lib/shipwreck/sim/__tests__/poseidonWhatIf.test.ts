import { poseidon } from "../../ships";
import { simulate, whatIfOpenings, whatIfRealIds, whatIfSpots } from "../run";
import type { WaveVariant } from "../wave";

/**
 * The Poseidon's What if (spec "What if", Task 4's matrix): every run of
 * no spots, each spot alone and all seven, for each of the three waves,
 * plus ballroom+vents and fwd-win+lobby for the real wave. Every one ends
 * inside `endS` with an outcome and finite poses (the Carpathia lesson:
 * the whole matrix, not a sample).
 */

const SPOTS = whatIfSpots(poseidon);
const WAVE_T = poseidon.wave!.group.t;
const MIN = 60;

const sets: string[][] = [[], ...SPOTS.map((id) => [id]), SPOTS];
const runs: { wave: WaveVariant; ids: string[] }[] = [
  ...(["real", "smaller", "ahead"] as const).flatMap((wave) =>
    sets.map((ids) => ({ wave, ids }))
  ),
  { wave: "real", ids: ["ballroom", "vents"] },
  { wave: "real", ids: ["fwd-win", "lobby"] },
  { wave: "real", ids: ["stern", "vents"] },
  // The pairs that sink her sooner than all seven (every pair was run:
  // sim README, "The Poseidon's calibration").
  { wave: "real", ids: ["aft-win", "mid-win"] },
  { wave: "real", ids: ["aft-win", "lobby"] },
  { wave: "real", ids: ["mid-win", "fwd-win"] },
];

/**
 * The real wave's outcomes as physics gives them (the box flood fills
 * only the boxes behind open spots): she sinks with her front windows
 * broken, or with all seven, or with a pair that floods one end or her
 * middle of her upper rooms but not the rest; anything else floats keel
 * up to `endS`.
 */
const REAL_SINKS = new Set([
  "all",
  "fwd-win",
  "fwd-win+lobby",
  "aft-win+mid-win",
  "aft-win+lobby",
  "mid-win+fwd-win",
]);
const name = (ids: string[]) =>
  ids.length === 0
    ? "none"
    : ids.length === SPOTS.length
      ? "all"
      : ids.join("+");
/** Her list from upright (0..180°), roll unwrapped. */
const lean = (deg: number) => {
  const l = ((deg % 360) + 360) % 360;
  return Math.min(l, 360 - l);
};

describe("the Poseidon's What if", () => {
  it("offers her seven spots, every one real", () => {
    expect(SPOTS).toHaveLength(7);
    expect(whatIfRealIds(poseidon)).toEqual(SPOTS);
    expect(whatIfOpenings(poseidon, SPOTS)).toEqual(poseidon.realNight);
  });

  describe.each(runs)("$wave wave, $ids", ({ wave, ids }) => {
    const track = simulate(poseidon, whatIfOpenings(poseidon, ids, wave), {
      wave,
    });
    const label = `${wave}/${name(ids)}`;

    it(`${label} ends inside endS with an outcome and finite poses`, () => {
      const last = track.frames[track.frames.length - 1];
      expect(track.endT).toBeLessThanOrEqual(poseidon.endS! + 1e-6);
      // (Within a float's rounding of the last step.)
      expect(last.t).toBeLessThanOrEqual(poseidon.endS! + 1e-6);
      expect(["sank", "floated", "capsized"]).toContain(track.outcome);
      for (const f of track.frames)
        for (const b of f.bodies)
          for (const v of [b.x, b.y, b.z, b.pitch, b.roll, b.yaw])
            expect(Number.isFinite(v)).toBe(true);
    });

    it(`${label} ends as the spec says`, () => {
      const capsized = track.events.some((e) => e.kind === "capsized");
      const last = track.frames[track.frames.length - 1];
      if (wave === "real") {
        expect(capsized).toBe(true);
        if (REAL_SINKS.has(name(ids))) {
          expect(track.outcome).toBe("sank");
          expect(last.groundedParts).toContain("whole");
        } else {
          expect(track.outcome).toBe("capsized");
          expect(last.t).toBeCloseTo(poseidon.endS!, 6);
        }
        return;
      }
      // The smaller wave and the wave from ahead: she rides it out.
      expect(capsized).toBe(false);
      expect(track.outcome).toBe("floated");
      expect(track.events.filter((e) => e.kind === "sheltered")).toHaveLength(
        1
      );
      expect(last.t).toBeLessThanOrEqual(WAVE_T + 6 * MIN);
      expect(lean(last.listDeg)).toBeLessThanOrEqual(
        poseidon.rideOut!.maxListDeg
      );
      const most = Math.max(...track.frames.map((f) => lean(f.listDeg)));
      if (wave === "ahead") expect(most).toBeLessThanOrEqual(15);
      else {
        // Leans to about 45° and stands up again.
        expect(most).toBeGreaterThanOrEqual(40);
        expect(most).toBeLessThanOrEqual(60);
      }
    });
  });
});
