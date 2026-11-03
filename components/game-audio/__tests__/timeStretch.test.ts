import { stretchChannels } from "../timeStretch";

const RATE = 24000;

function tone(hz: number, seconds: number): Float32Array {
  const out = new Float32Array(Math.round(RATE * seconds));
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Math.sin((2 * Math.PI * hz * i) / RATE);
  }
  return out;
}

/** Rising zero crossings per second: the pitch of a clean tone. */
function pitch(data: Float32Array): number {
  // Skip the fade at each end.
  const from = Math.round(data.length * 0.1);
  const to = Math.round(data.length * 0.9);
  let crossings = 0;
  for (let i = from + 1; i < to; i += 1) {
    if (data[i - 1] < 0 && data[i] >= 0) crossings += 1;
  }
  return crossings / ((to - from) / RATE);
}

describe("time stretch", () => {
  it.each([1.25, 1.5, 2, 0.75])(
    "plays %sx as fast at the same pitch",
    (rate) => {
      const input = tone(220, 2);
      const [out] = stretchChannels([input], RATE, rate);
      expect(out.length / input.length).toBeCloseTo(1 / rate, 1);
      expect(pitch(out)).toBeGreaterThan(220 * 0.95);
      expect(pitch(out)).toBeLessThan(220 * 1.05);
    }
  );

  it("keeps every channel the same length", () => {
    const outs = stretchChannels([tone(220, 1), tone(330, 1)], RATE, 1.5);
    expect(outs[0].length).toBe(outs[1].length);
  });

  it("hands back a copy at normal speed", () => {
    const input = tone(220, 0.5);
    const [out] = stretchChannels([input], RATE, 1);
    expect(out).toEqual(input);
    expect(out).not.toBe(input);
  });
});
