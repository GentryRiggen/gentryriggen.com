import { computeSailSpeed, computeStats } from "../stats";
import { emptyShip } from "../placement";
import { HULL_ID } from "../types";
import { attachPart, gridPart } from "../../testing";

function sloop() {
  const ship = emptyShip("pirate", "S", 6, 3);
  return {
    ...ship,
    parts: [
      gridPart("d0", "deck-1x1", 0, 8, 1),
      gridPart("helm", "helm-wheel", 1, 8, 0),
      attachPart("m", "mast-wood-tall", "d0", "mast"),
      attachPart("s0", "sail-square-large", "m", "sail:0"),
      attachPart("s1", "sail-square", "m", "sail:1"),
      attachPart("jib", "sail-jib", HULL_ID, "jib"),
      attachPart("r", "rudder", HULL_ID, "rudder"),
      attachPart("c", "cannon-chaser", HULL_ID, "bowgun"),
    ],
  };
}

describe("pirate stats", () => {
  it("has no speed and a failing sails check without sails", () => {
    const stats = computeStats(emptyShip("pirate"));
    expect(stats.topSpeedKnots).toBe(0);
    expect(stats.checks.find((c) => c.code === "no-sails")?.ok).toBe(false);
    expect(stats.checks.map((c) => c.code)).not.toContain("no-funnels");
  });

  it("moves on sail area alone and counts cannons", () => {
    const stats = computeStats(sloop());
    expect(stats.sailArea).toBe(9);
    expect(stats.cannons).toBe(1);
    expect(stats.topSpeedKnots).toBeGreaterThan(5);
    expect(stats.checks.find((c) => c.code === "no-sails")?.ok).toBe(true);
    expect(stats.checks.find((c) => c.code === "no-bridge")?.ok).toBe(true);
  });

  it("asks for a rudder once there is a sail", () => {
    const noRudder = sloop();
    noRudder.parts = noRudder.parts.filter((p) => p.id !== "r");
    expect(computeStats(noRudder).warnings.map((w) => w.code)).toContain(
      "no-rudder"
    );
  });

  it("is faster with more sail and clamps", () => {
    expect(computeSailSpeed(4, 6, 10000)).toBeLessThan(
      computeSailSpeed(20, 6, 10000)
    );
    expect(computeSailSpeed(200, 20, 0)).toBe(14);
    expect(computeSailSpeed(0, 6, 0)).toBe(0);
  });

  it("scales crew with the hull, 5 a segment", () => {
    expect(computeStats(emptyShip("pirate", "x", 10, 4)).crew).toBe(50);
  });

  it("leaves other kinds' stats alone", () => {
    const stats = computeStats(emptyShip("liner"));
    expect(stats.sailArea).toBe(0);
    expect(stats.cannons).toBe(0);
    expect(stats.checks.map((c) => c.code)).toContain("no-funnels");
    expect(stats.checks.map((c) => c.code)).not.toContain("no-sails");
  });
});
