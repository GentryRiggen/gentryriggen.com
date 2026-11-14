import { newRun } from "../../engine/engine";
import { ALL_UNIVERSES } from "../staging";
import { higherUniverse } from "../higher";
import { incomePerSecond } from "../higher/tick";
import { formatNumber } from "../../engine/format";

for (const def of ALL_UNIVERSES) {
  test(`${def.title}: every shop item explains its effect without opening About`, () => {
    for (const upgrade of def.upgrades) {
      const run = newRun(def);
      run.phase = Math.max(
        0,
        def.phases.findIndex((p) => upgrade.phases?.includes(p.id))
      );
      def.phases[run.phase].onEnter?.(run);
      const preview = upgrade.effectPreview?.(run);
      expect({
        id: upgrade.id,
        hasPreview: typeof preview === "string" && preview.trim().length > 0,
      }).toEqual({ id: upgrade.id, hasPreview: true });
      expect(preview).not.toMatch(/NaN|Infinity|undefined/);
    }
  });
}

test("a helper leads with its actual gain and keeps the resulting rate visible", () => {
  const run = newRun(higherUniverse);
  run.owned.bear = 2;
  const before = incomePerSecond(run);
  const after = incomePerSecond({ ...run, owned: { bear: 3 } });
  const preview = higherUniverse.upgrades.find((u) => u.id === "bear")!
    .effectPreview!(run);
  expect(preview).toContain(`+${formatNumber(after - before)}`);
  expect(preview).toContain(`${formatNumber(after)}`);
});

test("chapter exits have an explicit chapter badge and an effect", () => {
  const exit = higherUniverse.upgrades.find((u) => u.id === "treehouse")!;
  expect(exit.badge).toBe("NEXT CHAPTER");
  expect(exit.effectPreview!(newRun(higherUniverse))).toMatch(/town/i);
});
