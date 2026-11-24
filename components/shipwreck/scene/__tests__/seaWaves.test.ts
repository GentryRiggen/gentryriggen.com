import { fitzgerald } from "@/lib/shipwreck/ships/fitzgerald";
import { poseidon } from "@/lib/shipwreck/ships/poseidon";
import { GRAV } from "@/lib/shipwreck/sim/constants";
import { simulate } from "@/lib/shipwreck/sim/run";
import { stormOf, waveField } from "@/lib/shipwreck/sim/waves";
import {
  ROGUE_SHARPEN_MAX,
  SEA_MAX_GROUPS,
  createSeaWaves,
  packSeaWaves,
  rogueLipAt,
  rogueLookOf,
  seaElevationOf,
} from "../seaWaves";

/**
 * The rogue wave's look on the storm's sea (Task 9, spec "The wave on
 * screen"): only a group left out of her ride (`ride: false`, the
 * Poseidon's wave) is sharpened, leans and gets a breaking lip; every
 * other group, and the Fitzgerald's whole sea, packs and draws as before.
 */

describe("the Fitzgerald's sea is unchanged", () => {
  const storm = stormOf(fitzgerald)!;
  const field = waveField(storm, 1);

  it("has no rogue look on any of her groups", () => {
    expect(storm.groups?.length).toBeGreaterThan(0);
    expect(Array.from(rogueLookOf(storm))).toEqual(
      new Array(4 * SEA_MAX_GROUPS).fill(0)
    );
  });

  it("packs the same uniforms with or without the look, the look all zeros", () => {
    for (const t of [0, 1200, 9000]) {
      const plain = createSeaWaves();
      const looked = createSeaWaves();
      packSeaWaves(field, t, 76000, -1200, plain);
      packSeaWaves(field, t, 76000, -1200, looked, rogueLookOf(storm));
      expect(Array.from(looked.wave)).toEqual(Array.from(plain.wave));
      expect(Array.from(looked.groupA)).toEqual(Array.from(plain.groupA));
      expect(Array.from(looked.groupB)).toEqual(Array.from(plain.groupB));
      expect(looked.count).toBe(plain.count);
      expect(looked.groupCount).toBe(plain.groupCount);
      expect(looked.meanK).toBe(plain.meanK);
      expect(looked.hs).toBe(plain.hs);
      expect(Array.from(looked.groupC).every((v) => v === 0)).toBe(true);
      expect(Array.from(plain.groupC).every((v) => v === 0)).toBe(true);
    }
  });
});

describe("the Poseidon's rogue wave on screen", () => {
  const storm = stormOf(poseidon)!;
  const groups = storm.groups ?? [];
  const rogue = groups.findIndex((g) => g.ride === false);

  it("sharpens only her rogue wave's group, capped below folding", () => {
    expect(rogue).toBeGreaterThanOrEqual(0);
    const look = rogueLookOf(storm);
    groups.forEach((g, i) => {
      if (i === rogue) return;
      expect(look[4 * i]).toBe(0);
      expect(look[4 * i + 1]).toBe(0);
      expect(look[4 * i + 2]).toBe(0);
    });
    const g = groups[rogue];
    const w = (2 * Math.PI) / g.periodS;
    const ka = ((w * w) / GRAV) * (g.heightM / 2);
    expect(look[4 * rogue] * ka).toBeCloseTo(ROGUE_SHARPEN_MAX, 5);
    expect(ROGUE_SHARPEN_MAX).toBeLessThan(1);
    // The wave from ahead is in her ride: no look.
    const ahead = stormOf(poseidon, "ahead")!;
    expect(Array.from(rogueLookOf(ahead)).every((v) => v === 0)).toBe(true);
  });

  it("whitens its lip for its last ~150 m before her and lets it go after", () => {
    expect(rogueLipAt(-30)).toBe(0);
    expect(rogueLipAt(-4)).toBe(1);
    expect(rogueLipAt(0)).toBeGreaterThan(0.7);
    expect(rogueLipAt(30)).toBe(0);
    // About 150 m at its phase speed (g/ω) is 6–7 s before her.
    const g = groups[rogue];
    const c = GRAV / ((2 * Math.PI) / g.periodS);
    expect(150 / c).toBeGreaterThan(5);
    expect(150 / c).toBeLessThan(8);
    expect(rogueLipAt(-150 / c)).toBeGreaterThan(0.3);
  });

  it("packs the look per frame and leaves the surface's height the sim's", () => {
    const track = simulate(poseidon, poseidon.realNight);
    const field = waveField(track.storm!, track.stormScale ?? 1);
    const look = rogueLookOf(track.storm);
    const plain = createSeaWaves();
    const looked = createSeaWaves();
    packSeaWaves(field, -2, 0, 0, plain);
    packSeaWaves(field, -2, 0, 0, looked, look);
    const i = (track.storm!.groups ?? []).findIndex((g) => g.ride === false);
    expect(looked.groupC[4 * i]).toBe(look[4 * i]);
    expect(looked.groupC[4 * i + 2]).toBeCloseTo(
      rogueLipAt(-2 - field.group[i * 10 + 5]),
      5
    );
    // The look moves the vertices sideways only: the height is the same.
    for (const [x, y] of [
      [0, 0],
      [30, 120],
      [-80, -40],
    ])
      expect(seaElevationOf(looked, x, y)).toBe(seaElevationOf(plain, x, y));
  });
});
