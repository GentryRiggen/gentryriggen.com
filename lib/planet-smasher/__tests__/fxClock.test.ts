import { fxClock, setTimeScale, stepDt } from "../fxClock";

afterEach(() => setTimeScale(1));

describe("fxClock time scale", () => {
  it("scales the step", () => {
    setTimeScale(0.25);
    expect(stepDt(0.016)).toBeCloseTo(0.004);
  });
  it("still caps the raw step first", () => {
    setTimeScale(0.5);
    expect(stepDt(1)).toBeCloseTo(fxClock.maxDt * 0.5);
  });
  it("clamps to 0.05..1", () => {
    setTimeScale(0);
    expect(fxClock.timeScale).toBe(0.05);
    setTimeScale(2);
    expect(fxClock.timeScale).toBe(1);
  });
});
