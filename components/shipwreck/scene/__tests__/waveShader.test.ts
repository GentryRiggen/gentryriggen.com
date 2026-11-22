import { fitzgerald } from "@/lib/shipwreck/ships/fitzgerald";
import { STORM_SCALE } from "@/lib/shipwreck/sim/constants";
import type { SimTrack } from "@/lib/shipwreck/sim/track";
import {
  boardingElevation,
  lockGroups,
  significantHeight,
  stormOf,
  waveField,
} from "@/lib/shipwreck/sim/waves";
import {
  SEA_MAX_GROUPS,
  SEA_MAX_WAVES,
  SEA_WAVES_GLSL,
  createSeaWaves,
  packSeaWaves,
  seaFieldOf,
  seaElevationOf,
  seaSlopeOf,
  spacingFade,
} from "../seaWaves";

/**
 * The storm's sea on screen is the sim's own (spec north-star 1): the
 * shader's constants are `waveField` of the track's storm, and the
 * surface it draws (this TS mirror of its GLSL, in float32 as the GPU
 * holds it) is `boardingElevation`, the sea the deck openings see, also
 * out at her 76–101 km from the origin (the phases are worked out on the
 * CPU about the sea mesh's centre each frame, so float32 stays precise).
 */

const storm = stormOf(fitzgerald)!;

function trackOf(scale = 1): SimTrack {
  return {
    frames: [],
    events: [],
    outcome: "sank",
    sankAtT: null,
    brokeAtT: null,
    breakX: null,
    endT: 0,
    storm,
    stormScale: scale,
  };
}

/** 20 sample points (earth x, y) within 2 km of a centre. */
function samples(cx: number, cy: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < 20; i += 1) {
    const a = i * 2.39996;
    const r = 3 + i * i * 4.7;
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}

describe("the storm sea's constants", () => {
  it("are waveField of the track's storm at its scale (one source of truth)", () => {
    const track = trackOf(STORM_SCALE.worse);
    const field = seaFieldOf(track)!;
    expect(field).toEqual(waveField(storm, STORM_SCALE.worse));
    // Cached per storm: the same object while the track's storm holds.
    expect(seaFieldOf({ ...track })).toBe(field);
    // The components are the ship's own storm's.
    const own = waveField(fitzgerald.storm!, STORM_SCALE.worse);
    for (const key of ["amplitude", "k", "dirCos", "dirSin", "omega", "phase"])
      expect(field[key as keyof typeof field]).toEqual(
        own[key as keyof typeof own]
      );
    expect(field.meanK).toBe(own.meanK);
    // No storm, no field.
    expect(seaFieldOf({ ...track, storm: undefined })).toBeNull();
  });

  it("fit in the shader's arrays", () => {
    const field = waveField(storm);
    expect(field.count).toBeLessThanOrEqual(SEA_MAX_WAVES);
    expect(field.groupCount).toBeLessThanOrEqual(SEA_MAX_GROUPS);
    expect(SEA_WAVES_GLSL).toContain(`uWave[${SEA_MAX_WAVES}]`);
    expect(SEA_WAVES_GLSL).toContain(`uGroupA[${SEA_MAX_GROUPS}]`);
  });
});

describe("the surface the shader draws", () => {
  const cases: [string, number, number, number, number][] = [
    // name, shown t, centre x, centre y, scale
    ["3:30 PM at the origin", 0, 0, 0, 1],
    ["5:30 PM, 41 km on", 7200, 41000, 140, 1],
    [
      "the three sisters at 7:12 PM, 76 km on",
      storm.groups![0].t,
      76170,
      267,
      1,
    ],
    ["a worse storm 101 km out", 12000, 101000, -900, STORM_SCALE.worse],
    ["a calmer storm", 9000, 52000, 180, STORM_SCALE.calmer],
  ];
  for (const [name, t, cx, cy, scale] of cases)
    it(`is boardingElevation at 20 points: ${name}`, () => {
      const field = waveField(storm, scale);
      const waves = createSeaWaves();
      // The mesh's centre, snapped as the sea does, near the points.
      const ox = Math.round(cx / 8) * 8 + 4;
      const oy = Math.round(cy / 8) * 8 - 4;
      packSeaWaves(field, t, ox, oy, waves);
      for (const [x, y] of samples(cx, cy)) {
        const want = boardingElevation(storm, x, y, t, scale);
        const got = seaElevationOf(waves, x - ox, y - oy);
        expect(Math.abs(got - want)).toBeLessThan(0.01);
      }
    });

  it("slopes as the sim's sea does (its normals)", () => {
    const t = storm.groups![0].t;
    const field = waveField(storm);
    const waves = createSeaWaves();
    const ox = 76168;
    const oy = 260;
    packSeaWaves(field, t, ox, oy, waves);
    const h = 0.05;
    for (const [x, y] of samples(76170, 267)) {
      const [sx, sy] = seaSlopeOf(waves, x - ox, y - oy);
      const fx =
        (boardingElevation(storm, x + h, y, t) -
          boardingElevation(storm, x - h, y, t)) /
        (2 * h);
      const fy =
        (boardingElevation(storm, x, y + h, t) -
          boardingElevation(storm, x, y - h, t)) /
        (2 * h);
      // The group's envelope slope is left out of the normals (it is
      // about 1/(k·L) ≈ 0.04 of the carrier's).
      expect(Math.abs(sx - fx)).toBeLessThan(0.03);
      expect(Math.abs(sy - fy)).toBeLessThan(0.03);
    }
  });

  it("knows the sea's height now (for the foam): the ramp's", () => {
    const field = waveField(storm);
    const waves = createSeaWaves();
    packSeaWaves(field, 0, 0, 0, waves);
    expect(waves.hs).toBeCloseTo(significantHeight(storm, 1, 0), 3);
    packSeaWaves(field, 4.5 * 3600, 0, 0, waves);
    expect(waves.hs).toBeCloseTo(significantHeight(storm, 1, 4.5 * 3600), 3);
  });
});

describe("the re-locked storm and the spacing fade", () => {
  it("draws the track's re-locked storm, not the spec's (ruling R7)", () => {
    // The sim re-locks the three sisters on her real path: a new storm
    // object with the group moved. The scene draws that one.
    const g = storm.groups![0];
    const relocked = lockGroups(
      { ...storm, groups: [{ ...g, x: undefined, y: undefined }] },
      (t) => [5.9 * t, 0.4 * t]
    );
    expect(relocked.groups![0].x).not.toBeCloseTo(g.x!, 0);
    const track = { ...trackOf(1), storm: relocked };
    const field = seaFieldOf(track)!;
    expect(field).toEqual(waveField(relocked, 1));
    expect(seaFieldOf(trackOf(1))).not.toBe(field);
    const t = relocked.groups![0].t;
    const cx = relocked.groups![0].x!;
    const cy = relocked.groups![0].y!;
    const waves = createSeaWaves();
    packSeaWaves(seaFieldOf(track)!, t, cx, cy, waves);
    let moved = 0;
    for (const [x, y] of samples(cx, cy)) {
      const want = boardingElevation(relocked, x, y, t);
      expect(
        Math.abs(seaElevationOf(waves, x - cx, y - cy) - want)
      ).toBeLessThan(0.01);
      moved = Math.max(
        moved,
        Math.abs(want - boardingElevation(storm, x, y, t))
      );
    }
    // The re-lock moved the big seas there.
    expect(moved).toBeGreaterThan(0.5);
  });

  it("fades out only the components too short for the mesh's spacing", () => {
    expect(spacingFade(0.1, 0)).toBe(1);
    expect(spacingFade(0.1, 10)).toBe(1); // k·s = 1
    expect(spacingFade(0.1, 30)).toBe(0); // k·s = 3
    const mid = spacingFade(0.1, 20); // k·s = 2
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    // In the mirror: with a coarse spacing the surface is the one with
    // those components' amplitudes scaled by the fade, nothing else.
    const field = waveField(storm);
    const waves = createSeaWaves();
    packSeaWaves(field, 9000, 50000, 100, waves);
    const spacing = 14;
    const faded = createSeaWaves();
    packSeaWaves(field, 9000, 50000, 100, faded);
    let cut = 0;
    for (let i = 0; i < faded.count; i += 1) {
      const k = Math.hypot(faded.wave[4 * i + 1], faded.wave[4 * i + 2]);
      const f = spacingFade(k, spacing);
      if (f < 1) cut += 1;
      faded.wave[4 * i] *= f;
    }
    expect(cut).toBeGreaterThan(0);
    expect(cut).toBeLessThan(faded.count);
    for (const [x, y] of samples(0, 0)) {
      const a = seaElevationOf(waves, x, y, spacing);
      expect(a).toBeCloseTo(seaElevationOf(faded, x, y), 5);
    }
  });
});
