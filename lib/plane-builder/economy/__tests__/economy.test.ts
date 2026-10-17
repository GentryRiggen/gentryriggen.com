import { LEVELS } from "../../levels";
import { tierPrice } from "../../plane/catalog";
import type { FlightResult } from "../../sim/flight";
import { LANDING_BONUS, MILESTONE_SHARE, payout } from "../payout";
import {
  buyUpgrade,
  newProgress,
  recordFlight,
  restartLevel,
} from "../progress";

const meadow = LEVELS.meadow;
const flight = (over: Partial<FlightResult> = {}): FlightResult => ({
  distance: 100,
  coins: 5,
  rings: 0,
  finished: false,
  endReason: "landed",
  ...over,
});

describe("payout", () => {
  it("pays distance plus coins, times the multiplier", () => {
    const p = payout(
      meadow,
      flight({ distance: 1000, coins: 20, endReason: "crash" }),
      2,
      1000
    );
    expect(p.total).toBe(Math.round((1000 * meadow.payPerMeter + 20) * 2));
  });
  it("never pays less than the level minimum", () => {
    expect(payout(meadow, flight({ distance: 0, coins: 0 }), 1).total).toBe(
      meadow.minPayout
    );
  });
});

describe("bonuses", () => {
  const each = Math.round(
    meadow.finishDistance * meadow.payPerMeter * MILESTONE_SHARE
  );

  it("pays each milestone the first time it is passed", () => {
    const p = payout(meadow, flight({ distance: 1100, coins: 0 }), 1, 0);
    expect(p.milestoneBonus).toBe(each * 2); // 25% and 50%
    const again = payout(meadow, flight({ distance: 1100, coins: 0 }), 1, 1000);
    expect(again.milestoneBonus).toBe(0);
    const next = payout(meadow, flight({ distance: 1600, coins: 0 }), 1, 1100);
    expect(next.milestoneBonus).toBe(each);
  });

  it("pays nothing more on a finished level", () => {
    const p = payout(meadow, flight({ distance: 2000, coins: 0 }), 1, 2000);
    expect(p.milestoneBonus).toBe(0);
  });

  it("pays a landing bonus only for a landing", () => {
    const landed = payout(
      meadow,
      flight({ distance: 400, endReason: "landed" }),
      1
    );
    expect(landed.landingBonus).toBe(
      Math.round(landed.distancePay * LANDING_BONUS)
    );
    const crash = payout(
      meadow,
      flight({ distance: 400, endReason: "crash" }),
      1
    );
    expect(crash.landingBonus).toBe(0);
  });

  it("multiplies the whole total", () => {
    const p = payout(
      meadow,
      flight({ distance: 600, coins: 10, endReason: "landed" }),
      2,
      0
    );
    expect(p.total).toBe(
      Math.round(
        (p.distancePay + p.coinPay + p.landingBonus + p.milestoneBonus) * 2
      )
    );
  });
});

describe("progress", () => {
  it("starts with only the meadow unlocked and nothing owned", () => {
    const p = newProgress();
    expect(p.unlocked).toEqual(["meadow"]);
    expect(p.levels.meadow.coins).toBe(0);
  });

  it("buys a tier when you can afford it", () => {
    const price = tierPrice(meadow.plane.wings, 0)!;
    let p = newProgress();
    p = {
      ...p,
      levels: { ...p.levels, meadow: { ...p.levels.meadow, coins: price + 3 } },
    };
    const r = buyUpgrade(p, "meadow", "wings");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.progress.levels.meadow.tiers.wings).toBe(1);
    expect(r.progress.levels.meadow.coins).toBe(3);
    expect(p.levels.meadow.tiers.wings).toBe(0);
  });

  it("refuses when too poor, maxed or locked", () => {
    const p = newProgress();
    expect(buyUpgrade(p, "meadow", "wings")).toEqual({
      ok: false,
      reason: "too-poor",
    });
    expect(buyUpgrade(p, "canyon", "wings")).toEqual({
      ok: false,
      reason: "locked",
    });
    const maxed = {
      ...p,
      levels: {
        ...p.levels,
        meadow: {
          ...p.levels.meadow,
          coins: 1e9,
          tiers: { ...p.levels.meadow.tiers, wings: 8 },
        },
      },
    };
    expect(buyUpgrade(maxed, "meadow", "wings")).toEqual({
      ok: false,
      reason: "maxed",
    });
  });

  it("records pay and a new best", () => {
    const r = recordFlight(newProgress(), "meadow", flight(), 50);
    expect(r.progress.levels.meadow.coins).toBe(50);
    expect(r.progress.levels.meadow.best).toBe(100);
    expect(r.isNewBest).toBe(true);
    const again = recordFlight(
      r.progress,
      "meadow",
      flight({ distance: 80 }),
      10
    );
    expect(again.isNewBest).toBe(false);
    expect(again.progress.levels.meadow.best).toBe(100);
  });

  it("caps coins and ignores bad earnings", () => {
    const rich = recordFlight(newProgress(), "meadow", flight(), 5e12);
    expect(rich.progress.levels.meadow.coins).toBe(1e9);
    for (const bad of [NaN, Infinity, -50]) {
      const r = recordFlight(newProgress(), "meadow", flight(), bad);
      expect(r.progress.levels.meadow.coins).toBe(0);
    }
  });

  it("unlocks the next level once on finishing", () => {
    const r = recordFlight(
      newProgress(),
      "meadow",
      flight({ distance: 2000, finished: true }),
      1
    );
    expect(r.unlocked).toBe("canyon");
    expect(r.progress.unlocked).toEqual(["meadow", "canyon"]);
    expect(r.progress.levels.meadow.finished).toBe(true);
    const again = recordFlight(
      r.progress,
      "meadow",
      flight({ finished: true }),
      1
    );
    expect(again.unlocked).toBeNull();
  });

  it("restarts one level and keeps unlocks", () => {
    let p = recordFlight(
      newProgress(),
      "meadow",
      flight({ distance: 2000, finished: true }),
      500
    ).progress;
    p = recordFlight(p, "canyon", flight(), 70).progress;
    const r = restartLevel(p, "meadow");
    expect(r.levels.meadow).toEqual(newProgress().levels.meadow);
    expect(r.levels.canyon.coins).toBe(70);
    expect(r.unlocked).toEqual(["meadow", "canyon"]);
  });
});
