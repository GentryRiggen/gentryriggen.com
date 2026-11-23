import {
  SCENE_SETTINGS,
  isDaylit,
  sceneSettingsFor,
} from "@/components/shipwreck/scene/settings";
import {
  underLightOf,
  UNDER_LIGHT,
} from "@/components/shipwreck/scene/underLight";
import { SHIP_IDS } from "../ships";
import { resolveTime, timesOf } from "../times";

describe("times of day (1.9)", () => {
  it.each(SHIP_IDS)("%s: real first, no hour offered twice", (ship) => {
    const ids = timesOf(ship).map((o) => o.id);
    expect(ids[0]).toBe("real");
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("the storm ship keeps her storm: only the storm by day besides", () => {
    expect(timesOf("fitzgerald").map((o) => o.id)).toEqual([
      "real",
      "storm-day",
    ]);
    const day = sceneSettingsFor("fitzgerald", "storm-day");
    expect(day.storm).toBe(true);
    expect(day.stormLight).toBe(1);
  });

  it("each liner's real hour is not offered again as a fun one", () => {
    expect(timesOf("titanic").map((o) => o.id)).not.toContain("night");
    expect(timesOf("lusitania").map((o) => o.id)).not.toContain("afternoon");
    expect(timesOf("britannic").map((o) => o.id)).not.toContain("morning");
  });

  it.each(SHIP_IDS)(
    "%s: real (or an hour she lacks) is her own scene exactly",
    (ship) => {
      expect(sceneSettingsFor(ship, null)).toBe(SCENE_SETTINGS[ship]);
      expect(sceneSettingsFor(ship, "real")).toBe(SCENE_SETTINGS[ship]);
      expect(sceneSettingsFor(ship, "nope")).toBe(SCENE_SETTINGS[ship]);
      expect(resolveTime(ship, "nope")).toBe("real");
    }
  );

  it.each(SHIP_IDS)(
    "%s: another hour keeps her place and is the same object each time",
    (ship) => {
      const real = SCENE_SETTINGS[ship];
      for (const o of timesOf(ship)) {
        const s = sceneSettingsFor(ship, o.id);
        expect(sceneSettingsFor(ship, o.id)).toBe(s);
        expect(s.coast).toBe(real.coast);
        expect(s.iceberg).toBe(real.iceberg);
        expect(s.headingDeg).toBe(real.headingDeg);
        expect(s.convoy).toBe(real.convoy);
        expect(s.wakePath).toBe(real.wakePath);
        if (o.id === "night") expect(isDaylit(s)).toBe(false);
        if (o.id === "afternoon" || o.id === "morning" || o.id === "sunset")
          expect(isDaylit(s)).toBe(true);
      }
    }
  );

  it("the water light's real step changes nothing; lighter steps only lighten", () => {
    expect(underLightOf(0)).toEqual({ fog: 1, lift: 0, ambient: 1, lamp: 1 });
    expect(underLightOf(7)).toBe(UNDER_LIGHT[0]);
    for (let i = 1; i < UNDER_LIGHT.length; i += 1) {
      expect(UNDER_LIGHT[i].fog).toBeLessThan(UNDER_LIGHT[i - 1].fog);
      expect(UNDER_LIGHT[i].lift).toBeGreaterThan(UNDER_LIGHT[i - 1].lift);
      expect(UNDER_LIGHT[i].ambient).toBeGreaterThan(
        UNDER_LIGHT[i - 1].ambient
      );
    }
  });
});
