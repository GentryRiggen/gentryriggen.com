import { sceneInfo } from "@/lib/ever-onward/universes/light";
import { LET_GO } from "@/lib/ever-onward/universes/light/upgrades";
import { lightUniverse } from "@/lib/ever-onward/universes/light";
import { newRun } from "@/lib/ever-onward/engine/engine";
import { COAST_LIGHTHOUSES } from "@/lib/ever-onward/universes/light/resources";
import { calloutFor, CALLOUT_IDS } from "../callouts";

describe("scene callouts", () => {
  const info = sceneInfo(newRun(lightUniverse));

  it("has a spot and a label for every upgrade in the shop", () => {
    for (const upgrade of lightUniverse.upgrades) {
      const callout = calloutFor({ upgradeId: upgrade.id, n: 1 }, info);
      expect([upgrade.id, callout?.text]).toEqual([
        upgrade.id,
        expect.any(String),
      ]);
    }
  });

  it("has no callout for an upgrade that is not in the shop", () => {
    const ids = new Set(lightUniverse.upgrades.map((u) => u.id));
    expect(CALLOUT_IDS.filter((id) => !ids.has(id))).toEqual([]);
  });

  it("keeps every callout inside the picture", () => {
    for (const id of CALLOUT_IDS) {
      for (const n of [1, 5, 8]) {
        const callout = calloutFor({ upgradeId: id, n }, info);
        expect(callout?.x).toBeGreaterThanOrEqual(0);
        expect(callout?.x).toBeLessThanOrEqual(400);
        expect(callout?.y).toBeGreaterThanOrEqual(0);
        expect(callout?.y).toBeLessThanOrEqual(300);
      }
    }
  });

  it("points each let-go at the light of the same position in LET_GO", () => {
    LET_GO.forEach((light, i) => {
      const callout = calloutFor({ upgradeId: light.id, n: 1 }, info);
      expect(callout).not.toBeNull();
      expect(CALLOUT_IDS.indexOf(light.id)).toBeGreaterThan(-1);
      expect(CALLOUT_IDS.filter((id) => id.startsWith("letgo-"))[i]).toBe(
        light.id
      );
    });
  });

  it("names the same lighthouse count the caption caps at", () => {
    const last = lightUniverse.upgrades.find((u) => u.id === "lighthouse");
    const callout = calloutFor(
      { upgradeId: "lighthouse", n: last?.maxLevel ?? 0 },
      info
    );
    expect(callout?.text).toContain(String(COAST_LIGHTHOUSES));
  });
});
