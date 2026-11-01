import {
  growUniverse as def,
  sceneInfo,
} from "@/lib/ever-onward/universes/grow";
import { runAtPhaseStart } from "@/lib/ever-onward/universes/grow/__tests__/fixtures";
import { CALLOUT_IDS, CAPTION_ONLY, calloutFor } from "../callouts";

describe("grow scene callouts", () => {
  const info = sceneInfo(runAtPhaseStart(0));
  const yardUpgrades = def.upgrades.filter((u) => u.phases?.includes("yard"));

  it("lands every yard upgrade visibly", () => {
    for (const u of yardUpgrades) {
      const landed =
        calloutFor({ id: 1, upgradeId: u.id, n: 1 } as never, info) !== null;
      expect([u.id, landed || CAPTION_ONLY.has(u.id)]).toEqual([u.id, true]);
    }
  });

  it("has no callout for an upgrade that is not in the yard shop", () => {
    const ids = new Set(yardUpgrades.map((u) => u.id));
    expect(CALLOUT_IDS.filter((id) => !ids.has(id))).toEqual([]);
  });

  it("keeps every callout inside the picture", () => {
    for (const id of CALLOUT_IDS) {
      for (const n of [1, 4, 8, 12]) {
        const c = calloutFor({ upgradeId: id, n }, info);
        expect(c?.x).toBeGreaterThanOrEqual(0);
        expect(c?.x).toBeLessThanOrEqual(400);
        expect(c?.y).toBeGreaterThanOrEqual(0);
        expect(c?.y).toBeLessThanOrEqual(300);
      }
    }
  });
});
