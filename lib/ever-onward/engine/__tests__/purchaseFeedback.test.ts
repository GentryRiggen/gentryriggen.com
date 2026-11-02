import {
  newRun,
  previewBiggestChange,
  previewChangesNothing,
  upgradeNoEffectReason,
} from "../engine";
import { growUniverse } from "../../universes/grow";
import { handHarvestPays } from "../../universes/grow/actions";
import { manualPerTap, incomePerSecond } from "../../universes/grow/tick";
import { formatNumber } from "../format";

const upgrade = (id: string) => growUniverse.upgrades.find((u) => u.id === id)!;

test.each(["basket", "gardener"])(
  "%s still warns when no produce is growing",
  (id) => {
    const run = newRun(growUniverse);
    const preview = upgrade(id).effectPreview!(run);
    expect(previewChangesNothing(preview)).toBe(true);
    expect(previewBiggestChange(preview)).toBe(0);
    expect(upgradeNoEffectReason(run, upgrade(id))).toMatch(/limit/i);
  }
);

test.each(["basket", "gardener"])(
  "%s still explains purchases that barely help",
  (id) => {
    const run = newRun(growUniverse);
    run.owned =
      id === "basket"
        ? { sprinkler: 6, basket: 1, gardener: 3 }
        : { sprinkler: 6, basket: 6, gardener: 1 };
    const change = previewBiggestChange(upgrade(id).effectPreview!(run));
    expect(change).not.toBeNull();
    expect(change!).toBeLessThan(0.02);
    expect(upgradeNoEffectReason(run, upgrade(id))).toMatch(/limit/i);
  }
);

test("multiline effect summaries keep all before-and-after stats", () => {
  expect(
    previewChangesNothing("No extra picking\nPicks/sec 388 → 388\nRate 2 → 2")
  ).toBe(true);
  expect(
    previewChangesNothing("More income\nPicks/sec 388 → 388\nRate 2 → 3")
  ).toBe(false);
  expect(
    previewBiggestChange("+2 picks/sec\nPicks/sec 388 → 390\nRate 2 → 2")
  ).toBeCloseTo(2 / 388);
});

test("the honey stand explains the hand harvest it actually improves", () => {
  const run = newRun(growUniverse);
  run.resources.produce = 100;
  run.owned.sprinkler = 3;
  const after = { ...run, owned: { ...run.owned, "honey-stand": 1 } };
  expect(manualPerTap(after)).toBe(manualPerTap(run));
  expect(incomePerSecond(after)).toBe(incomePerSecond(run));
  const preview = upgrade("honey-stand").effectPreview!(run);
  expect(preview).toMatch(/hand.*harvest/i);
  expect(preview).toContain(
    `${formatNumber(handHarvestPays(run))} → ${formatNumber(handHarvestPays(after))}`
  );
  expect(previewBiggestChange(preview)).toBeCloseTo(
    handHarvestPays(after) / handHarvestPays(run) - 1
  );
});
