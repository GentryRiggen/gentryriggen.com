import {
  DOLLY_AMOUNT,
  createSlowMo,
  dollyAmount,
  realAt,
  slowMoScale,
} from "../slowMoClock";

describe("slowMoScale", () => {
  it("holds 0.25, ramps to 1 by 1.2 s, then stays at 1", () => {
    expect(slowMoScale(0)).toBe(0.25);
    expect(slowMoScale(0.79)).toBe(0.25);
    expect(slowMoScale(1.0)).toBeCloseTo(0.625);
    expect(slowMoScale(1.2)).toBe(1);
    expect(slowMoScale(5)).toBe(1);
  });
});

describe("dollyAmount", () => {
  it("pushes in by 15%, holds to 1.2 s, then eases back to 0", () => {
    expect(dollyAmount(0)).toBe(0);
    expect(dollyAmount(0.6)).toBeCloseTo(DOLLY_AMOUNT);
    expect(dollyAmount(1.19)).toBeCloseTo(DOLLY_AMOUNT);
    expect(dollyAmount(1.6)).toBeGreaterThan(0);
    expect(dollyAmount(1.6)).toBeLessThan(DOLLY_AMOUNT);
    expect(dollyAmount(3)).toBe(0);
  });
});

describe("createSlowMo", () => {
  const make = (reduced = false) => {
    const scales: number[] = [];
    const zoom = { factor: 1 };
    const ctl = createSlowMo({
      setTimeScale: (s) => scales.push(s),
      scaleCamera: (k) => {
        zoom.factor *= k;
      },
      reducedMotion: reduced,
    });
    return { ctl, scales, zoom };
  };

  it("slows time and dollies in while it runs", () => {
    const { ctl, scales, zoom } = make();
    ctl.update(0.5);
    expect(scales.at(-1)).toBe(0.25);
    expect(zoom.factor).toBeCloseTo(1 - DOLLY_AMOUNT);
  });

  it("restores time and the camera when disposed early", () => {
    const { ctl, scales, zoom } = make();
    ctl.update(0.5);
    ctl.dispose();
    expect(scales.at(-1)).toBe(1);
    expect(zoom.factor).toBeCloseTo(1);
  });

  it("restores after a full run too", () => {
    const { ctl, scales, zoom } = make();
    for (let i = 0; i < 100; i++) ctl.update(0.05);
    expect(scales.at(-1)).toBe(1);
    ctl.dispose();
    expect(zoom.factor).toBeCloseTo(1);
  });

  it("skips the dolly but keeps the slow motion under reduced motion", () => {
    const { ctl, scales, zoom } = make(true);
    ctl.update(0.5);
    expect(scales.at(-1)).toBe(0.25);
    expect(zoom.factor).toBe(1);
  });
});

describe("realAt", () => {
  it("is the real time at which sim time reaches a value", () => {
    expect(realAt(0)).toBe(0);
    expect(realAt(0.2)).toBeCloseTo(0.8);
    expect(realAt(0.45)).toBeCloseTo(1.2);
  });
  it("is continuous across the ramp", () => {
    expect(realAt(0.2001) - realAt(0.2)).toBeLessThan(0.001);
    expect(realAt(0.4501) - realAt(0.45)).toBeLessThan(0.001);
    expect(realAt(0.3)).toBeGreaterThan(0.8);
    expect(realAt(0.3)).toBeLessThan(1.2);
  });
  it("has slope 1 once time is back to normal", () => {
    expect(realAt(5) - realAt(4)).toBeCloseTo(1);
    expect(realAt(2.5)).toBeCloseTo(3.25);
  });
  it("inverts the slow-mo integral", () => {
    for (const s of [0.1, 0.3, 0.4, 1, 2]) {
      let sim = 0;
      const r = realAt(s);
      const step = 0.0005;
      for (let t = 0; t < r; t += step) sim += slowMoScale(t) * step;
      expect(sim).toBeCloseTo(s, 1);
    }
  });
});
