import { sceneInfo } from "@/lib/ever-onward/universes/light";
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

  it("has a spot for every step of the last part's shop", () => {
    for (const base of ["hearth", "sail", "company", "song", "slowburn"]) {
      const steps = lightUniverse.upgrades.filter((u) =>
        u.id.startsWith(`${base}-`)
      );
      expect(steps.length).toBeGreaterThan(0);
      for (const step of steps) expect(CALLOUT_IDS).toContain(step.id);
    }
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
