import { newRun } from "../../../engine/engine";
import { simulate } from "../../../engine/sim";
import { emberReward } from "../../../engine/prestige";
import { typicalPrestige } from "../../../engine/score";
import { growBots } from "../bots";
import { PRESTIGE } from "../prestige";
import { def } from "./fixtures";

describe("Acorns", () => {
  it("has 4 to 6 upgrades, each with a name, a description and a cost", () => {
    expect(PRESTIGE.upgrades.length).toBeGreaterThanOrEqual(4);
    expect(PRESTIGE.upgrades.length).toBeLessThanOrEqual(6);
    for (const u of PRESTIGE.upgrades) {
      expect(u.name).toBeTruthy();
      expect(u.description).toBeTruthy();
      expect(u.cost).toBeGreaterThan(0);
    }
  });

  it("shapes a fresh run: barrels, sprinklers and a head start", () => {
    const run = newRun(def, {
      "acorn-barrel": 2,
      "acorn-friend": 1,
      "acorn-packet": 2,
    });
    expect(run.owned["rain-barrel"]).toBe(2);
    expect(run.owned.sprinkler).toBe(2);
    expect(run.mods.headStart).toBe(2);
  });

  it("makes run 2 at least 25% quicker with typical Acorns", () => {
    const first = simulate(def, {
      strategy: growBots().tapper,
      maxSeconds: 8 * 3600,
    });
    const embers = emberReward(def, first.finalRun);
    const second = simulate(def, {
      strategy: growBots().tapper,
      maxSeconds: 8 * 3600,
      prestige: typicalPrestige(def, embers),
    });
    expect(second.finishTime! / first.finishTime!).toBeLessThanOrEqual(0.75);
  });
});
