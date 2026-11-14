import { startLaserTicker } from "../laserTicker";

describe("startLaserTicker", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("keeps ticking at the cooldown rate with no pointer movement", () => {
    const aim = { held: true, ticks: 0 };
    let readyAt = 0;
    const stop = startLaserTicker(aim, () => {
      const now = Date.now();
      if (now < readyAt) return false;
      readyAt = now + 125;
      return true;
    });
    jest.advanceTimersByTime(1000);
    stop();
    expect(aim.ticks).toBeGreaterThanOrEqual(7);
    expect(aim.ticks).toBeLessThanOrEqual(9);
  });

  it("stops ticking on release and when stopped", () => {
    const aim = { held: true, ticks: 0 };
    const stop = startLaserTicker(aim, () => true);
    jest.advanceTimersByTime(100);
    aim.held = false;
    const at = aim.ticks;
    jest.advanceTimersByTime(500);
    expect(aim.ticks).toBe(at);
    stop();
  });
});
