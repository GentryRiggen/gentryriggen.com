import { POP_H, POP_W, gridFromLuminance } from "../population";
import { FIRST_ENDING_BONUS } from "../progress";
import { COMBO_CAP, COMBO_PLANET_CAP, useGameStore } from "../store";

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

  it("ignores repeat ticks of overlapping shots", () => {
    const start = s().progress.points;
    let raw = 0;
    for (let i = 0; i < 10; i++) {
      raw += s().hit(
        "asteroid",
        i / 10 + 0.05,
        0.5,
        i * 100,
        (i % 2) + 1
      ).rawPoints;
    }
    // No combo bonus on top of the hits' own (floored) points.
    expect(s().progress.points - start).toBe(Math.floor(raw + 1e-9));
    expect(s().combo.count).toBeLessThanOrEqual(2);
    expect(s().lastHit?.combo ?? 0).toBeLessThanOrEqual(2);
  });

  it("ignores hits while ending", () => {
    s().hit("moonRam", 0.2, 0.5, 100);
    const combo = { ...s().combo };
    s().hit("asteroid", 0.3, 0.5, 200);
    expect(s().combo).toEqual(combo);
  });
});

describe("combo counts once per shot", () => {
  it("six impacts of one fire move nothing past 1", () => {
    const before = s().progress.points;
    let gained = 0;
    for (let i = 0; i < 6; i++) {
      const p = s().progress.points;
      const r = s().hit("asteroid", 0.1 + i * 0.1, 0.5, i * 100, 7);
      gained += s().progress.points - p - r.points;
    }
    expect(s().combo.count).toBe(1);
    expect(gained).toBeLessThanOrEqual(1); // only carried fractions
    expect(s().progress.points).toBeGreaterThan(before);
  });

  it("separate fires 1, 2, 3 reach 3 and pay 3", () => {
    s().hit("asteroid", 0.1, 0.5, 0, 1);
    s().hit("asteroid", 0.2, 0.5, 400, 2);
    const p = s().progress.points;
    const r = s().hit("asteroid", 0.3, 0.5, 800, 3);
    expect(s().combo.count).toBe(3);
    expect(s().lastHit?.combo).toBe(3);
    expect(s().progress.points - p).toBeGreaterThanOrEqual(r.points + 3);
  });

  it("a laser-style run of 20 hits with one fire pays no bonus", () => {
    for (let i = 0; i < 20; i++) {
      s().hit("alienLaser", 0.5, 0.5, i * 125, 9);
    }
    expect(s().combo.count).toBe(1);
  });

  it("a later fire after a long hold starts a fresh combo", () => {
    for (let i = 0; i < 20; i++) s().hit("alienLaser", 0.5, 0.5, i * 125, 9);
    s().hit("asteroid", 0.2, 0.5, 2600, 10);
    expect(s().combo.count).toBe(1);
  });
});

describe("combo counts only shots that kill people", () => {
  // People on the left half of the map only.
  const half = gridFromLuminance(
    Array.from({ length: POP_W * POP_H }, (_, i) =>
      i % POP_W < POP_W / 2 ? 1 : 0
    ),
    POP_W,
    POP_H,
    0
  );

  it("leaves the combo, its window and the badge alone on empty ground", () => {
    s().init(half);
    s().hit("asteroid", 0.1, 0.5, 0, 1);
    s().hit("asteroid", 0.2, 0.5, 400, 2);
    expect(s().combo).toEqual({ count: 2, lastAt: 400 });
    const lastHit = s().lastHit;
    const points = s().progress.points;
    const r = s().hit("asteroid", 0.9, 0.5, 900, 3);
    expect(r.peopleLost).toBe(0);
    expect(s().combo).toEqual({ count: 2, lastAt: 400 });
    expect(s().lastHit).toBe(lastHit);
    expect(s().progress.points - points).toBeLessThanOrEqual(r.points + 1);
    // The window still runs from the last people-killing shot.
    s().hit("asteroid", 0.15, 0.5, 1300, 4);
    expect(s().combo.count).toBe(3);
  });
});

describe("combo bonus cap per planet", () => {
  it("200 fast distinct fires earn exactly the planet cap", () => {
    const start = s().progress.points;
    let raw = 0;
    for (let i = 0; i < 200; i++) {
      raw += s().hit(
        "alienLaser",
        (i % 50) / 50 + 0.01,
        0.3 + (i % 4) * 0.13,
        i * 100,
        i + 1
      ).rawPoints;
    }
    // The planet may end along the way; its first-ending bonus is not combo.
    const ending = s().ending ? FIRST_ENDING_BONUS : 0;
    expect(COMBO_PLANET_CAP).toBe(300);
    expect(s().comboBonus).toBe(COMBO_PLANET_CAP);
    expect(s().progress.points - start).toBe(
      Math.floor(raw + 1e-9) + COMBO_PLANET_CAP + ending
    );
  });

  it("resets on a new planet, a planet switch and init", () => {
    for (let i = 0; i < 40; i++)
      s().hit("alienLaser", 0.5, 0.5, i * 100, i + 1);
    expect(s().comboBonus).toBeGreaterThan(0);
    s().init(grid);
    expect(s().comboBonus).toBe(0);
    for (let i = 0; i < 40; i++)
      s().hit("alienLaser", 0.5, 0.5, i * 100, i + 1);
    useGameStore.setState({ phase: "ended" });
    s().newPlanet(grid);
    expect(s().comboBonus).toBe(0);
    for (let i = 0; i < 40; i++)
      s().hit("alienLaser", 0.5, 0.5, i * 100, i + 1);
    s().selectPlanet("earth", grid);
    expect(s().comboBonus).toBe(0);
  });
});
