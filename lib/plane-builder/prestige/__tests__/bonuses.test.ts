import {
  GREEN_HALF,
  YELLOW_HALF,
  gaugeZone,
  greenHalf,
} from "../../minigame/gauge";
import type { PlaneStats } from "../../plane/stats";
import { applyBonuses, coinFactor, emptyBonuses } from "../bonuses";

const STATS: PlaneStats = {
  launchSpeed: 40,
  lift: 0.01,
  thrust: 5,
  fuel: 10,
  drag: 0.001,
  shields: 1,
  multiplier: 2,
};
const with_ = (over: Partial<ReturnType<typeof emptyBonuses>>) => ({
  ...emptyBonuses(),
  ...over,
});

describe("applyBonuses", () => {
  it("changes nothing with no bonuses", () => {
    expect(applyBonuses(STATS, emptyBonuses())).toEqual(STATS);
  });

  it("adds 10% fuel per copy with no cap", () => {
    expect(applyBonuses(STATS, with_({ fuel: 3 })).fuel).toBeCloseTo(13);
    expect(applyBonuses(STATS, with_({ fuel: 100 })).fuel).toBeCloseTo(110);
  });

  it("adds 5% lift and launch speed per copy, capped at +100%", () => {
    const some = applyBonuses(STATS, with_({ lift: 4, launch: 2 }));
    expect(some.lift).toBeCloseTo(0.012);
    expect(some.launchSpeed).toBeCloseTo(44);
    const lots = applyBonuses(STATS, with_({ lift: 500, launch: 500 }));
    expect(lots.lift).toBeCloseTo(0.02);
    expect(lots.launchSpeed).toBeCloseTo(80);
  });

  it("adds a shield per charm, up to +5", () => {
    expect(applyBonuses(STATS, with_({ shield: 2 })).shields).toBe(3);
    expect(applyBonuses(STATS, with_({ shield: 99 })).shields).toBe(6);
  });

  it("leaves the multiplier, thrust and drag alone and doesn't mutate", () => {
    const copy = { ...STATS };
    const out = applyBonuses(STATS, with_({ coins: 5, star: 2 }));
    expect(out.multiplier).toBe(STATS.multiplier);
    expect(out.thrust).toBe(STATS.thrust);
    expect(out.drag).toBe(STATS.drag);
    expect(STATS).toEqual(copy);
  });
});

describe("coinFactor", () => {
  it("is 1 with nothing", () => {
    expect(coinFactor(emptyBonuses())).toBe(1);
  });
  it("adds 10% per Golden Wind", () => {
    expect(coinFactor(with_({ coins: 5 }))).toBeCloseTo(1.5);
  });
  it("doubles per star, up to x64", () => {
    expect(coinFactor(with_({ star: 3 }))).toBe(8);
    expect(coinFactor(with_({ star: 6 }))).toBe(64);
    expect(coinFactor(with_({ star: 20 }))).toBe(64);
  });
  it("multiplies the two together", () => {
    expect(coinFactor(with_({ coins: 10, star: 2 }))).toBeCloseTo(8);
  });
});

describe("greenHalf", () => {
  it("is the normal width with no clovers", () => {
    expect(greenHalf(0)).toBe(GREEN_HALF);
  });
  it("widens 10% per clover", () => {
    expect(greenHalf(5)).toBeCloseTo(GREEN_HALF * 1.5);
  });
  it("caps at 0.2 and never passes yellow", () => {
    expect(greenHalf(1000)).toBe(0.2);
    expect(greenHalf(1000)).toBeLessThanOrEqual(YELLOW_HALF);
  });
  it("makes gaugeZone call wider stops green", () => {
    expect(gaugeZone(0.5 + 0.1)).toBe("yellow");
    expect(gaugeZone(0.5 + 0.1, greenHalf(10))).toBe("green");
  });
});
