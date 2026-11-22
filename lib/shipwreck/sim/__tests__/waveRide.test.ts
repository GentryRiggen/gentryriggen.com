import { fitzgerald } from "../../ships";
import type { StormSpec } from "../../ships/types";
import { GRAV } from "../constants";
import { predictedPath, stormOf, waveElevation } from "../waves";
import {
  RIDE_FADE_S,
  rideDz,
  rideWeight,
  rollSlopeFactor,
  waveRide,
} from "../waveRide";

/**
 * Her ride on the waves: the quasi-static heave, pitch and roll the sim's
 * deck openings and the scene share (waveRide.ts).
 */

const DEG = Math.PI / 180;
const spec = fitzgerald;
const out = new Float64Array(3);

/** One wave of period T toward dirDeg (ship frame), amplitude a. */
function oneWave(periodS: number, dirDeg: number, a = 1, phase = 0): StormSpec {
  return {
    components: [{ amplitudeM: a, periodS, dirDeg, phase }],
    hsM: 4 * a * Math.SQRT1_2,
    windKn: 0,
  };
}
const kOf = (T: number) => (2 * Math.PI) ** 2 / (GRAV * T * T);
/** The period whose deep-water wavelength is L (m). */
const periodFor = (L: number) => Math.sqrt((2 * Math.PI * L) / GRAV);

/**
 * Brute-force check: the least-squares plane through the field's pressure
 * head under her bottom (η·e^(−kT) per component; with `smith` false the
 * surface's own η) over an L × B grid.
 */
function fitPlane(
  storm: StormSpec,
  x0: number,
  y0: number,
  t: number,
  smith = true
) {
  const n = 201;
  const m = 21;
  let s = 0;
  let sx = 0;
  let sy = 0;
  let xx = 0;
  let yy = 0;
  let cnt = 0;
  for (let i = 0; i < n; i += 1)
    for (let j = 0; j < m; j += 1) {
      const x = -spec.lbp / 2 + (spec.lbp * (i + 0.5)) / n;
      const y = -spec.beam / 2 + (spec.beam * (j + 0.5)) / m;
      let e = 0;
      for (const c of storm.components) {
        const k = kOf(c.periodS);
        const d = c.dirDeg * DEG;
        e +=
          c.amplitudeM *
          (smith ? Math.exp(-k * spec.draught) : 1) *
          Math.cos(
            k * ((x0 + x) * Math.cos(d) + (y0 + y) * Math.sin(d)) -
              ((2 * Math.PI) / c.periodS) * t +
              c.phase
          );
      }
      s += e;
      sx += e * x;
      sy += e * y;
      xx += x * x;
      yy += y * y;
      cnt += 1;
    }
  return { heave: s / cnt, slopeX: sx / xx, slopeY: sy / yy };
}

describe("her ride on the waves", () => {
  it("is the least-squares plane her waterplane feels", () => {
    // Along, across and between: heave and pitch as a fitted plane of the
    // pressure head under her; roll as the surface's own slope across her
    // times the IMO effective wave slope coefficient.
    const r = rollSlopeFactor(spec);
    for (const [T, dir] of [
      [11, 0],
      [9, 30],
      [14, -60],
      [7, 90],
    ] as const) {
      const storm = oneWave(T, dir, 2, 0.7);
      for (const t of [0, 3.3, 7.1]) {
        waveRide(storm, 1, 120, -40, spec, t, out);
        const fit = fitPlane(storm, 120, -40, t);
        const surface = fitPlane(storm, 120, -40, t, false);
        expect(out[0]).toBeCloseTo(fit.heave, 3);
        expect(out[1]).toBeCloseTo(-Math.atan(fit.slopeX), 4);
        expect(out[2]).toBeCloseTo(Math.atan(surface.slopeY * r), 4);
      }
    }
  });

  it("follows a long swell nearly whole and barely heaves on one her length", () => {
    // A 5 km swell along her: nearly all of it (e^(−kT) at her bottom),
    // pitched to its slope.
    const long = oneWave(periodFor(5000), 0, 1);
    const k = kOf(periodFor(5000));
    waveRide(long, 1, 0, 0, spec, 0, out);
    expect(out[0]).toBeGreaterThan(0.98);
    expect(out[0]).toBeLessThanOrEqual(Math.exp(-k * spec.draught));
    waveRide(long, 1, 1250, 0, spec, 0, out); // a quarter wave on: slope −k
    expect(out[1] / (k * Math.exp(-k * spec.draught))).toBeCloseTo(1, 2);
    // A wave exactly her length along her: the crest and trough cancel.
    const own = oneWave(periodFor(spec.lbp), 0, 1);
    for (const x of [0, 30, 60]) {
      waveRide(own, 1, x, 0, spec, 0, out);
      expect(Math.abs(out[0])).toBeLessThan(1e-6);
    }
  });

  it("scales with the storm, and is nothing without one", () => {
    const storm = stormOf(spec)!;
    const a = new Float64Array(3);
    waveRide(storm, 1, 1000, 20, spec, 5000, a);
    waveRide(storm, 0.6, 1000, 20, spec, 5000, out);
    expect(out[0]).toBeCloseTo(0.6 * a[0], 9);
    expect(Math.tan(out[1])).toBeCloseTo(0.6 * Math.tan(a[1]), 9);
    waveRide(storm, 0, 1000, 20, spec, 5000, out);
    for (const v of out) expect(Math.abs(v)).toBe(0);
  });

  it("stays gentle in her real storm: |pitch| ≤ 6°, |roll| ≤ 10°", () => {
    const storm = stormOf(spec)!;
    const path = predictedPath(spec);
    let pitch = 0;
    let roll = 0;
    let heave = 0;
    for (let t = 0; t < 4 * 3600; t += 0.5) {
      const [x, y] = path(t);
      waveRide(storm, 1, x, y, spec, t, out);
      pitch = Math.max(pitch, Math.abs(out[1]));
      roll = Math.max(roll, Math.abs(out[2]));
      heave = Math.max(heave, Math.abs(out[0]));
    }
    expect(pitch).toBeLessThanOrEqual(6 * DEG);
    expect(roll).toBeLessThanOrEqual(10 * DEG);
    // A 222 m hull in a 189 m sea heaves little of it (Hs 7.6 m).
    expect(heave).toBeLessThan(2);
    expect(pitch).toBeGreaterThan(0.5 * DEG);
  });

  it("rides her up with the sea: less relative motion than the still pose", () => {
    // Over an hour of her real storm, at her middle and her ends, the sea
    // against her riding deck moves less than against her still-water one
    // (a long hull in a sea a little shorter than she is: README).
    const storm = stormOf(spec)!;
    const path = predictedPath(spec);
    for (const x of [-95, 0, 62, 95]) {
      let still = 0;
      let rel = 0;
      let n = 0;
      for (let t = 3600; t < 2 * 3600; t += 0.5) {
        const [bx, by] = path(t);
        waveRide(storm, 1, bx, by, spec, t, out);
        const eta = waveElevation(storm, bx + x, by, t);
        still += eta * eta;
        rel += (eta - rideDz(out, x, 0)) ** 2;
        n += 1;
      }
      expect(Math.sqrt(rel / n)).toBeLessThan(Math.sqrt(still / n));
    }
  });

  it("fades out once her bow is under", () => {
    expect(rideWeight(100, null)).toBe(1);
    expect(rideWeight(100, 200)).toBe(1);
    expect(rideWeight(200 + RIDE_FADE_S / 2, 200)).toBeCloseTo(0.5, 9);
    expect(rideWeight(200 + RIDE_FADE_S, 200)).toBe(0);
    expect(rideWeight(1e6, 200)).toBe(0);
  });

  it("moves a ship-frame point by heave − x·pitch + y·roll", () => {
    const ride = Float64Array.from([0.5, 0.01, -0.02]);
    expect(rideDz(ride, 100, 0)).toBeCloseTo(0.5 - 1, 9);
    expect(rideDz(ride, 0, -10)).toBeCloseTo(0.5 + 0.2, 9);
  });
});
