import { LEVELS, LEVEL_ORDER } from "../../levels";
import { STARTER_TIERS } from "../../plane/catalog";
import { planeStats } from "../../plane/stats";
import { pilotFlight, playLevel } from "../pilot";

describe.each(LEVEL_ORDER)("%s balance", (id) => {
  const log = playLevel(id);
  const finish = LEVELS[id].finishDistance;

  it("takes 30-40 flights to finish", () => {
    expect(log[log.length - 1].distance).toBe(finish);
    expect(log.length).toBeGreaterThanOrEqual(30);
    expect(log.length).toBeLessThanOrEqual(40);
  });

  it("has at most 2 dry flights in a row", () => {
    let streak = 0;
    for (const f of log.slice(0, -1)) {
      const dry = f.cheapest !== null && f.earned < f.cheapest;
      streak = dry ? streak + 1 : 0;
      expect(streak).toBeLessThanOrEqual(2);
    }
  });

  it("starter plane gets under 10% of the way", () => {
    const stats = planeStats(LEVELS[id].plane, STARTER_TIERS);
    expect(pilotFlight(id, stats).distance).toBeLessThan(finish * 0.1);
  });

  it("best distance never drops by more than 10%", () => {
    let best = 0;
    for (const f of log) {
      expect(f.distance).toBeGreaterThanOrEqual(best * 0.9);
      best = Math.max(best, f.distance);
    }
  });
});
