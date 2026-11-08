import { newRun } from "../../engine/engine";
import { lightUniverse } from "../light";
import { growUniverse } from "../grow";
import { higherUniverse } from "../higher";
import { smileUniverse } from "../smile";
import { waterCapacity } from "../grow/water";
import { FUND_RESOURCE, isFundOpen } from "../light/fund";

describe("HUD gauges", () => {
  test("Grow shows the water tank, LOW then DRY", () => {
    const run = newRun(growUniverse);
    run.phase = 0;
    const max = waterCapacity(run);
    run.resources.tank = max;
    let gauge = growUniverse.gauge?.(run);
    expect(gauge).toMatchObject({ label: "WATER", isLow: false, status: "" });
    expect(gauge?.max).toBe(max);
    run.resources.tank = max * 0.2;
    gauge = growUniverse.gauge?.(run);
    expect(gauge).toMatchObject({ isLow: true, status: "LOW" });
    run.resources.tank = 0;
    gauge = growUniverse.gauge?.(run);
    expect(gauge).toMatchObject({ isCritical: true, status: "DRY" });
    run.phase = 3;
    expect(growUniverse.gauge?.(run)).toBeNull();
  });

  test("Smile shows the cheer meter as a percent, WARM then TIRED", () => {
    const run = newRun(smileUniverse);
    run.phase = 0;
    expect(smileUniverse.gauge?.(run)).toBeNull();
    run.phase = 1;
    run.resources.mtHeat = 0.2;
    expect(smileUniverse.gauge?.(run)).toMatchObject({
      label: "CHEER",
      display: "20%",
      isLow: false,
    });
    run.resources.mtHeat = 0.75;
    expect(smileUniverse.gauge?.(run)).toMatchObject({ status: "WARM" });
    run.resources.mtHeat = 1;
    run.resources.mtTired = 1;
    expect(smileUniverse.gauge?.(run)).toMatchObject({
      status: "TIRED",
      isCritical: true,
    });
  });

  test("Higher shows the playroom's lean and streak, then the town's sway", () => {
    const play = newRun(higherUniverse);
    expect(higherUniverse.gauge?.(play)).toBeNull();
    play.owned.bear = 3;
    play.resources.pcLean = 0.4;
    play.resources.pcStreak = 5;
    expect(higherUniverse.gauge?.(play)).toMatchObject({
      label: "LEAN",
      display: "40%",
      status: "STREAK 5",
      isLow: true,
    });
    const run = newRun(higherUniverse);
    run.phase = 1;
    run.resources.sway = 0.1;
    expect(higherUniverse.gauge?.(run)).toMatchObject({
      label: "SWAY",
      display: "10%",
      status: "",
    });
    run.resources.sway = 0.6;
    expect(higherUniverse.gauge?.(run)).toMatchObject({ status: "LEANS" });
    run.resources.sway = 0.8;
    expect(higherUniverse.gauge?.(run)).toMatchObject({
      status: "WOBBLY",
      isCritical: true,
    });
    const high = newRun(higherUniverse);
    high.phase = 2;
    high.owned["sky-crew"] = 3;
    high.resources.skWx = 2;
    expect(higherUniverse.gauge?.(high)).toMatchObject({
      label: "WIND",
      display: "GUST COMING!",
      isCritical: true,
    });
    run.phase = 3;
    expect(higherUniverse.gauge?.(run)).toBeNull();
  });

  test("Light keeps the flame on the HUD at the end, LOW then COLD", () => {
    const run = newRun(lightUniverse);
    run.phase = 3;
    run.resources.flame = 800;
    expect(lightUniverse.gauge?.(run)).toMatchObject({
      label: "FLAME",
      display: "80%",
      isLow: false,
    });
    run.resources.flame = 250;
    expect(lightUniverse.gauge?.(run)).toMatchObject({ status: "LOW" });
    expect(lightUniverse.alert?.(run)).toBeNull();
    run.resources.flame = 50;
    expect(lightUniverse.gauge?.(run)).toMatchObject({
      status: "COLD",
      isCritical: true,
    });
    expect(lightUniverse.alert?.(run)).toMatch(/Tap Tend/);
  });

  test("Light shows the jar's savings when nothing needs watching", () => {
    const run = newRun(lightUniverse);
    run.phase = 2;
    run.resources.probes = 0;
    run.owned.collector = 50;
    expect(isFundOpen(run)).toBe(true);
    expect(lightUniverse.gauge?.(run)).toBeNull();
    run.resources[FUND_RESOURCE] = 1234;
    expect(lightUniverse.gauge?.(run)).toMatchObject({
      hasBar: false,
      display: "1.23K saved",
    });
    run.resources.probes = 10;
    run.resources.heading = 40;
    expect(lightUniverse.gauge?.(run)).toMatchObject({
      label: "COURSE",
      display: "40%",
      status: "LOW",
    });
  });
});
