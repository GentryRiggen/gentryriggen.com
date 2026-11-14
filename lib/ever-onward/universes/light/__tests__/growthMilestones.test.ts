import { newRun } from "../../../engine/engine";
import { lightUniverse } from "..";
import { collectorEnergyPerSecond } from "../tick";

const withCollectors = (count: number) => {
  const run = newRun(lightUniverse);
  run.phase = 2;
  run.owned.collector = count;
  return run;
};

test("the third and sixth collector strengthen the array", () => {
  expect(
    collectorEnergyPerSecond(withCollectors(3)) /
      collectorEnergyPerSecond(withCollectors(2))
  ).toBeCloseTo(1.65);
  expect(
    collectorEnergyPerSecond(withCollectors(6)) /
      collectorEnergyPerSecond(withCollectors(5))
  ).toBeCloseTo(1.32);
});

test("the collector previews its next milestone", () => {
  const collector = lightUniverse.upgrades.find((u) => u.id === "collector")!;
  expect(collector.effectPreview!(withCollectors(1))).toMatch(/At 3.*10%/);
  expect(collector.effectPreview!(withCollectors(6))).not.toMatch(/At \d/);
});
