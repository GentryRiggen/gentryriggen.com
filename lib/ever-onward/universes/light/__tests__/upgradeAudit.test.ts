import { simulate } from "../../../engine/sim";
import { def } from "./fixtures";
import { lightBots } from "../bots";
import { TUNING } from "../tuning";

/**
 * Round 7's audit: every purchase must land. A step is either at least half
 * as big again as what it builds on (most double something), or the picture
 * shows something new for it. Steps that were small and showed nothing were
 * made bigger (or cut), and these numbers keep them that way.
 */

const C = TUNING.coast;
const N = TUNING.night;
const S = TUNING.sky;
const L = TUNING.last;

/** At least half as big again. */
const BIG = 1.5;

describe("every upgrade lands", () => {
  it("a better lens at least doubles the ships a flash guides, at every level", () => {
    for (let i = 1; i < C.lensShips.length; i += 1)
      expect(C.lensShips[i] / C.lensShips[i - 1]).toBeGreaterThanOrEqual(2);
  });

  it("every coast chain step is at least half as big again", () => {
    expect(1 / C.wickSaving).toBeGreaterThanOrEqual(BIG);
    expect(C.fareGrowth).toBeGreaterThanOrEqual(BIG);
    expect(C.dockBonus).toBeGreaterThanOrEqual(BIG);
    for (const step of C.trainingSteps) expect(step).toBeGreaterThanOrEqual(2);
    // Storms: the shutters and the glass each pay at least half as much again.
    for (let i = 1; i < C.stormPassive.length; i += 1)
      expect(C.stormPassive[i] / C.stormPassive[i - 1]).toBeGreaterThanOrEqual(
        BIG
      );
    // The tank: each step holds at least half as much oil again.
    const tank = (tier: number) => C.tankSeconds + C.tankSecondsPerTier * tier;
    expect(tank(1) / tank(0)).toBeGreaterThanOrEqual(BIG);
    expect(tank(2) / tank(1)).toBeGreaterThanOrEqual(BIG);
  });

  it("every night step is at least half as big again", () => {
    expect(N.lineBonus).toBeGreaterThanOrEqual(BIG);
    expect(N.substationBonus).toBeGreaterThanOrEqual(BIG);
    expect(1 / N.bulbSaving).toBeGreaterThanOrEqual(BIG);
    // The crank: the first turn up more than doubles it, the last half again.
    const crank = (level: number) => N.crankBase + N.crankPerLevel * level;
    expect(crank(1) / crank(0)).toBeGreaterThanOrEqual(2);
    expect(crank(2) / crank(1)).toBeGreaterThanOrEqual(BIG);
  });

  it("every sky step is at least half as big again", () => {
    expect(S.mirrorBonus).toBeGreaterThanOrEqual(BIG);
    expect(S.copyBonus).toBeGreaterThanOrEqual(BIG);
    expect(S.relayBonus).toBeGreaterThanOrEqual(BIG);
    expect(S.appetiteBonus).toBeGreaterThanOrEqual(2);
    expect(1 / S.engineSaving).toBeGreaterThanOrEqual(BIG);
    const aim = (level: number) => S.aimBase + S.aimPerLevel * level;
    expect(aim(1) / aim(0)).toBeGreaterThanOrEqual(2);
    expect(aim(2) / aim(1)).toBeGreaterThanOrEqual(BIG);
  });

  it("every light let go leaves a gift that is plainly felt", () => {
    expect(1 / L.fadeSaving).toBeGreaterThanOrEqual(BIG);
    expect(L.tapGift).toBeGreaterThanOrEqual(0.5);
    expect(L.burstFlame).toBeGreaterThanOrEqual(0.5 * L.startFlame);
    expect(L.reliefPerLetGo).toBeGreaterThanOrEqual(0.2);
  });

  it("no collector is bought that the picture does not draw", () => {
    const collector = def.upgrades.find((u) => u.id === "collector")!;
    // SkyLayer draws six; a seventh was only a number going up.
    expect(collector.maxLevel).toBe(6);
  });

  it("every purchase in a whole run is felt, or shows in the picture", () => {
    const r = simulate(def, {
      maxSeconds: 6 * 3600,
      step: 1,
      strategy: lightBots().tapper,
      trace: { sampleEvery: 600 },
    });
    expect(r.finished).toBe(true);
    const purchases = r.trace!.purchases;
    expect(purchases.length).toBeGreaterThan(80);
    const unfelt = purchases.filter(
      (p) => !p.meaningful && !p.sceneChanged && p.kind !== "mechanic"
    );
    expect(unfelt.map((p) => `${p.id} L${p.level}`)).toEqual([]);
    // Most of them are felt in the income too, not only seen.
    const felt = purchases.filter((p) => p.effectRatio >= 0.1).length;
    expect(felt / purchases.length).toBeGreaterThan(0.5);
  });
});
