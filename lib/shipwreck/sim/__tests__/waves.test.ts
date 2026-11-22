import type { StormSpec } from "../../ships/types";
import {
  GROUP_STRIDE,
  boardingElevation,
  boardingRow,
  lockGroups,
  rampAt,
  significantHeight,
  stormComponents,
  waveElevation,
  waveField,
} from "../waves";

/**
 * The storm's wave field: deterministic, fitted to its significant height,
 * with wave groups where the data puts them, and cheap to sample.
 */

const storm: StormSpec = {
  components: stormComponents({ hsM: 7.6, peakPeriodS: 9.5, dirDeg: 0 }),
  hsM: 7.6,
  windKn: 50,
};

/** σ of η over a long record at one point (and its 4σ). */
function recordSigma(s: StormSpec, x: number, y: number, scale = 1): number {
  let sum = 0;
  let sum2 = 0;
  let n = 0;
  for (let t = 0; t < 6 * 3600; t += 0.5) {
    const e = waveElevation(s, x, y, t, scale);
    sum += e;
    sum2 += e * e;
    n += 1;
  }
  const mean = sum / n;
  return Math.sqrt(sum2 / n - mean * mean);
}

describe("the storm's wave field", () => {
  it("is fitted to its significant height", () => {
    expect(significantHeight(storm)).toBeCloseTo(7.6, 6);
    for (const [x, y] of [
      [0, 0],
      [1234, -56],
      [40000, 300],
    ]) {
      const hs = 4 * recordSigma(storm, x, y);
      expect(Math.abs(hs - 7.6) / 7.6).toBeLessThan(0.05);
    }
  });

  it("has a spread of real periods around the peak, no repeat", () => {
    const periods = storm.components.map((c) => c.periodS);
    expect(Math.min(...periods)).toBeGreaterThan(4);
    expect(Math.max(...periods)).toBeLessThan(16);
    // No two components at the same period (the sea would repeat).
    expect(new Set(periods).size).toBe(periods.length);
    // A long record does not repeat at the spacing of the bins.
    const a = waveElevation(storm, 0, 0, 1000);
    const b = waveElevation(storm, 0, 0, 1000 + 150);
    expect(Math.abs(a - b)).toBeGreaterThan(1e-3);
  });

  it("is the same every time (no randomness)", () => {
    const again: StormSpec = {
      ...storm,
      components: stormComponents({ hsM: 7.6, peakPeriodS: 9.5, dirDeg: 0 }),
    };
    expect(again.components).toEqual(storm.components);
    for (const t of [0, 13.7, 5000])
      expect(waveElevation(again, 37, -5, t)).toBe(
        waveElevation(storm, 37, -5, t)
      );
  });

  it("travels toward dirDeg with deep-water dispersion", () => {
    // One component: the crest at x = 0, t = 0 is at x = c·t later.
    const one: StormSpec = {
      components: [{ amplitudeM: 2, periodS: 10, dirDeg: 0, phase: 0 }],
      hsM: 4 * Math.sqrt(2),
      windKn: 0,
    };
    const c = (9.81 * 10) / (2 * Math.PI);
    expect(waveElevation(one, 0, 0, 0)).toBeCloseTo(2, 9);
    expect(waveElevation(one, c * 3, 0, 3)).toBeCloseTo(2, 9);
    // Across its direction nothing changes.
    expect(waveElevation(one, c * 3, 500, 3)).toBeCloseTo(2, 9);
    const port: StormSpec = {
      ...one,
      components: [{ amplitudeM: 2, periodS: 10, dirDeg: 90, phase: 0 }],
    };
    expect(waveElevation(port, 0, c * 3, 3)).toBeCloseTo(2, 9);
  });

  it("a wave group raises the waves near its time by about its height", () => {
    // heightM is crest to trough: its biggest crest stands heightM/2 over
    // the sea's own crest there, its trough as far under.
    for (const t0 of [1000, 3000, 5000, 8000]) {
      const g = { t: t0, heightM: 4, count: 3, periodS: 11, dirDeg: 0 };
      const grouped = lockGroups({
        ...storm,
        groups: [{ ...g, x: 500, y: 20 }],
      });
      const locked = grouped.groups![0];
      expect(Math.abs(locked.t - t0)).toBeLessThanOrEqual(g.periodS / 2);
      let maxWith = -Infinity;
      let maxWithout = -Infinity;
      let dMax = -Infinity;
      let dMin = Infinity;
      for (let t = t0 - g.periodS / 2; t <= t0 + g.periodS / 2; t += 0.05) {
        const w = waveElevation(grouped, 500, 20, t);
        const o = waveElevation(storm, 500, 20, t);
        maxWith = Math.max(maxWith, w);
        maxWithout = Math.max(maxWithout, o);
      }
      for (let t = t0 - 120; t <= t0 + 120; t += 0.25) {
        const d =
          waveElevation(grouped, 500, 20, t) - waveElevation(storm, 500, 20, t);
        dMax = Math.max(dMax, d);
        dMin = Math.min(dMin, d);
      }
      // The group's own waves: crest to trough about heightM.
      expect(Math.abs(dMax - dMin - g.heightM) / g.heightM).toBeLessThan(0.1);
      // On the sea there: the crest maximum near t is higher by its crest.
      expect(maxWith - maxWithout).toBeGreaterThan(0.45 * g.heightM);
      expect(maxWith - maxWithout).toBeLessThan(0.55 * g.heightM);
      // Far from its time and place the group is gone.
      for (const t of [t0 - 3600, t0 + 3600])
        expect(waveElevation(grouped, 500, 20, t)).toBe(
          waveElevation(storm, 500, 20, t)
        );
    }
  });

  it("locks a group onto the crest under a moving ship", () => {
    // Her path: 5.72 m/s ahead and the drift to port. The sea is sampled
    // where she is at each candidate time, and the group placed there.
    const path = (t: number): [number, number] => [37 + 5.72 * t, 0.02 * t];
    for (const t0 of [1000, 3000, 5000, 8000]) {
      const g = { t: t0, heightM: 4, count: 3, periodS: 11, dirDeg: 21 };
      const locked = lockGroups({ ...storm, groups: [g] }, path).groups![0];
      expect(Math.abs(locked.t - t0)).toBeLessThanOrEqual(g.periodS / 2);
      const [lx, ly] = path(locked.t);
      expect(locked.x).toBeCloseTo(lx, 9);
      expect(locked.y).toBeCloseTo(ly, 9);
      const grouped = { ...storm, groups: [locked] };
      // Along her path, the highest wave within half a period of t comes
      // at the locked time, the sea's crest there plus the group's.
      let best = -Infinity;
      let bestT = 0;
      let sea = -Infinity;
      for (let t = t0 - g.periodS / 2; t <= t0 + g.periodS / 2; t += 0.05) {
        const [x, y] = path(t);
        const e = waveElevation(grouped, x, y, t);
        if (e > best) {
          best = e;
          bestT = t;
        }
        sea = Math.max(sea, waveElevation(storm, x, y, t));
      }
      expect(Math.abs(bestT - locked.t)).toBeLessThan(0.5);
      expect(best - sea).toBeGreaterThan(0.45 * g.heightM);
    }
  });

  it("scale scales the field's height", () => {
    const s1 = recordSigma(storm, 100, 0);
    const s06 = recordSigma(storm, 100, 0, 0.6);
    expect(s06 / s1).toBeCloseTo(0.6, 6);
    expect(significantHeight(storm, 1.25)).toBeCloseTo(7.6 * 1.25, 6);
  });

  it("packs the same field for the shader", () => {
    const grouped: StormSpec = {
      ...storm,
      groups: [{ t: 3000, heightM: 4, count: 3, periodS: 11, dirDeg: 10 }],
    };
    const f = waveField(grouped, 0.6);
    const n = storm.components.length;
    expect(f.count).toBe(n);
    for (const arr of [f.amplitude, f.k, f.dirCos, f.dirSin, f.omega, f.phase])
      expect(arr).toBeInstanceOf(Float32Array);
    expect(f.amplitude.length).toBe(n);
    const c0 = storm.components[0];
    const w0 = (2 * Math.PI) / c0.periodS;
    expect(f.amplitude[0]).toBeCloseTo(c0.amplitudeM * 0.6, 5);
    expect(f.omega[0]).toBeCloseTo(w0, 5);
    expect(f.k[0]).toBeCloseTo((w0 * w0) / 9.81, 5);
    expect(f.groupCount).toBe(1);
    expect(f.group.length).toBe(GROUP_STRIDE);
    expect(f.group[0]).toBeCloseTo(2 * 0.6, 5); // amplitude
    // The packed values give the CPU's elevation (float32 rounding apart).
    for (const [x, y, t] of [
      [0, 0, 0],
      [210, -12, 2990],
      [-80, 40, 3007],
    ]) {
      let e = 0;
      for (let i = 0; i < f.count; i += 1)
        e +=
          f.amplitude[i] *
          Math.cos(
            f.k[i] * (x * f.dirCos[i] + y * f.dirSin[i]) -
              f.omega[i] * t +
              f.phase[i]
          );
      for (let gi = 0; gi < f.groupCount; gi += 1) {
        const p = f.group.subarray(gi * GROUP_STRIDE, (gi + 1) * GROUP_STRIDE);
        const [amp, k, cs, sn, om, gt, gx, gy, len, cg] = p;
        const tau = t - gt;
        const s = (x - gx) * cs + (y - gy) * sn;
        const env = (s - cg * tau) / len;
        e += amp * Math.exp(-0.5 * env * env) * Math.cos(k * s - om * tau);
      }
      expect(e).toBeCloseTo(waveElevation(grouped, x, y, t, 0.6), 3);
    }
  });

  it("builds the sea through time by its ramp, the groups as they are", () => {
    // The hindcast's sea: 0.75 of its height at first, all of it from 3 h.
    const ramped: StormSpec = {
      ...storm,
      ramp: [
        [0, 0.75],
        [10800, 1],
      ],
      groups: [{ t: 5400, heightM: 4, count: 3, periodS: 11, dirDeg: 10 }],
    };
    const sea: StormSpec = { ...storm, groups: undefined };
    const group: StormSpec = { ...ramped, components: [], ramp: undefined };
    for (const [t, f] of [
      [-100, 0.75],
      [0, 0.75],
      [5400, 0.875],
      [10800, 1],
      [20000, 1],
    ]) {
      expect(rampAt(ramped, t)).toBeCloseTo(f, 12);
      for (const [x, y] of [
        [0, 0],
        [120, -30],
      ])
        expect(waveElevation(ramped, x, y, t, 0.6)).toBeCloseTo(
          (waveElevation(sea, x, y, t) * f + waveElevation(group, x, y, t)) *
            0.6,
          9
        );
    }
    expect(rampAt(storm, 1234)).toBe(1);
    // Hs of the sea now: the ramp times the fitted height (and the scale).
    expect(significantHeight(ramped, 1, 0)).toBeCloseTo(7.6 * 0.75, 9);
    expect(significantHeight(ramped, 0.6, 5400)).toBeCloseTo(
      7.6 * 0.6 * 0.875,
      9
    );
    expect(significantHeight(ramped)).toBeCloseTo(7.6, 9);
    // The shader gets the ramp's pairs.
    const f = waveField(ramped);
    expect(Array.from(f.ramp)).toEqual([0, 0.75, 10800, 1]);
    expect(f.rampCount).toBe(2);
    expect(waveField(storm).rampCount).toBe(0);
  });

  it("samples a million points quickly and without allocating", () => {
    expect(waveElevation.toString()).not.toMatch(/\bnew\b/);
    const t0 = Date.now();
    let acc = 0;
    for (let i = 0; i < 1e6; i += 1)
      acc += waveElevation(storm, i * 0.37, -i * 0.01, i * 0.013);
    expect(Number.isFinite(acc)).toBe(true);
    // About 0.1 µs per component here: well under a second for a million.
    expect(Date.now() - t0).toBeLessThan(5000);
  });

  it("raises its crests to second order for boarding (Tayfun, Stokes)", () => {
    // One wave: exactly Stokes' a·cos θ + (k·a²/2)·cos 2θ.
    const a = 3;
    const T = 11;
    const k = (2 * Math.PI) ** 2 / (9.81 * T * T);
    const one: StormSpec = {
      components: [{ amplitudeM: a, periodS: T, dirDeg: 0, phase: 0.4 }],
      hsM: 0,
      windKn: 0,
    };
    for (const [x, t] of [
      [0, 0],
      [40, 3],
      [-77, 8.2],
    ]) {
      const th = k * x - ((2 * Math.PI) / T) * t + 0.4;
      expect(boardingElevation(one, x, 5, t)).toBeCloseTo(
        a * Math.cos(th) + ((k * a * a) / 2) * Math.cos(2 * th),
        9
      );
    }
    // Her storm: crests higher than the linear sea's, troughs shallower,
    // the mean unchanged; the correction scales with the height squared.
    let top1 = 0;
    let top2 = 0;
    let lo1 = 0;
    let lo2 = 0;
    let mean = 0;
    let n = 0;
    for (let t = 0; t < 3600; t += 0.5) {
      const e1 = waveElevation(storm, 0, 0, t);
      const e2 = boardingElevation(storm, 0, 0, t);
      top1 = Math.max(top1, e1);
      top2 = Math.max(top2, e2);
      lo1 = Math.min(lo1, e1);
      lo2 = Math.min(lo2, e2);
      mean += e2;
      n += 1;
    }
    expect(top2).toBeGreaterThan(top1);
    expect(lo2).toBeGreaterThan(lo1);
    expect(Math.abs(mean / n)).toBeLessThan(0.05);
    const d1 =
      boardingElevation(storm, 3, 4, 77) - waveElevation(storm, 3, 4, 77);
    const d6 =
      boardingElevation(storm, 3, 4, 77, 0.6) -
      waveElevation(storm, 3, 4, 77, 0.6);
    expect(d6).toBeCloseTo(0.36 * d1, 9);
    // The shader's mean wavenumber.
    expect(waveField(storm).meanK).toBeGreaterThan(0);
    expect(boardingElevation.toString()).not.toMatch(/\bnew\b/);
  });

  it("samples a row of points as it samples each", () => {
    const grouped = lockGroups({
      ...storm,
      ramp: [
        [0, 0.8],
        [1000, 1],
      ],
      groups: [
        { t: 300, heightM: 5, count: 3, periodS: 9.5, dirDeg: 10, x: 50, y: 0 },
      ],
    });
    const out = new Float64Array(21);
    const scratch = new Float64Array(21);
    for (const t of [120, 297, 305]) {
      boardingRow(grouped, -60, 7, 7.3, -0.2, 21, t, 0.9, out, scratch);
      for (let j = 0; j < 21; j += 1)
        expect(out[j]).toBeCloseTo(
          boardingElevation(grouped, -60 + 7.3 * j, 7 - 0.2 * j, t, 0.9),
          8
        );
    }
  });

  it("is still water without a storm's components", () => {
    const calm: StormSpec = { components: [], hsM: 0, windKn: 0 };
    expect(waveElevation(calm, 10, 10, 10)).toBe(0);
    expect(significantHeight(calm)).toBe(0);
  });
});
