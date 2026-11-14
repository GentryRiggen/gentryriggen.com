import { POP_H, POP_W, gridFromLuminance } from "../population";
import { COMBO_CAP, useGameStore } from "../store";

const grid = gridFromLuminance(new Array(POP_W * POP_H).fill(1), POP_W, POP_H);
const s = () => useGameStore.getState();

beforeEach(() => {
  window.localStorage.clear();
  s().init(grid);
});

describe("combo", () => {
  it("counts hits inside the window and pays from the third", () => {
    s().hit("asteroid", 0.1, 0.5, 0);
    s().hit("asteroid", 0.2, 0.5, 500);
    const before = s().progress.points;
    const r = s().hit("asteroid", 0.3, 0.5, 1000);
    expect(s().combo.count).toBe(3);
    expect(s().lastHit?.combo).toBe(3);
    expect(s().progress.points).toBe(before + r.points + 3);
  });

  it("resets to 1 after the window", () => {
    s().hit("asteroid", 0.1, 0.5, 0);
    s().hit("asteroid", 0.2, 0.5, 500);
    s().hit("asteroid", 0.3, 0.5, 1000);
    s().hit("asteroid", 0.4, 0.5, 2500);
    expect(s().combo.count).toBe(1);
  });

  it("never pays more than the cap per hit", () => {
    let now = 0;
    for (let i = 0; i < 15; i++) {
      const before = s().progress.points;
      const r = s().hit("asteroid", (i % 10) / 10 + 0.05, 0.5, now);
      const gained = s().progress.points - before;
      // Carried fractions can add at most 1 whole point on top of the bonus.
      expect(gained).toBeLessThanOrEqual(r.points + 1 + COMBO_CAP);
      if (i >= 11) expect(s().combo.count).toBe(i + 1);
      now += 100;
    }
    expect(s().combo.count).toBe(15);
  });

  it("resets on a new planet", () => {
    s().hit("asteroid", 0.1, 0.5, 0);
    s().hit("moonRam", 0.2, 0.5, 100);
    s().endingShown();
    s().newPlanet(grid);
    expect(s().combo).toEqual({ count: 0, lastAt: 0 });
  });

  it("ignores hits while ending", () => {
    s().hit("moonRam", 0.2, 0.5, 100);
    const combo = { ...s().combo };
    s().hit("asteroid", 0.3, 0.5, 200);
    expect(s().combo).toEqual(combo);
  });
});
