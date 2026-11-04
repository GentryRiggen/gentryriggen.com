import { newRun } from "../../../engine/engine";
import { growUniverse } from "../index";
import { DRY_FLOOR } from "../water";

/** A card's About text is folded away, so the effect lines stand alone. */
function card(id: string, phase: number): string {
  const upgrade = growUniverse.upgrades.find((u) => u.id === id);
  const run = newRun(growUniverse);
  run.phase = phase;
  return upgrade!.effectPreview!(run) ?? "";
}

const lost = `${Math.round((1 - DRY_FLOOR) * 100)}% less`;

describe("water upgrade cards say what they fill and why it matters", () => {
  test.each([
    ["rain-barrel", 0, "produce"],
    ["garden-hose", 0, "produce"],
    ["well", 1, "harvest"],
    ["irrigation", 1, "harvest"],
    ["river-bend", 2, "green"],
  ])("%s names the tank and what a dry one costs", (id, phase, unit) => {
    const lines = card(id, phase).split("\n");
    expect(lines[0]).toMatch(/^Water tank \d+ → \d+$/);
    expect(lines[lines.length - 1]).toBe(`Dry tank: ${lost} ${unit}/sec`);
  });

  test.each([
    ["well", 1],
    ["river-bend", 2],
  ])("%s says seeping means water with no rain", (id, phase) => {
    expect(card(id, phase)).toContain("Seeps in water, rain or not");
  });

  test("the cloud seeder says where its rain goes", () => {
    expect(card("cloud-seeder", 2)).toBe("Rain into the tank 100% → 125%");
  });

  test("the watering can says what an answer pays", () => {
    expect(card("watering-can", 3)).toMatch(/^Care per answer 100% → \d+%$/);
  });
});
