import {
  growUniverse as def,
  sceneInfo,
} from "@/lib/ever-onward/universes/grow";
import { runAtPhaseStart } from "@/lib/ever-onward/universes/grow/__tests__/fixtures";
import {
  CALLOUT_IDS,
  CAPTION_ONLY,
  FARM_CALLOUT_IDS,
  SEED_CALLOUT_IDS,
  WORLD_CALLOUT_IDS,
  calloutFor,
} from "../callouts";

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

  describe("farm", () => {
    const farmInfo = sceneInfo(runAtPhaseStart(1));
    const farmUpgrades = def.upgrades.filter((u) => u.phases?.includes("farm"));

    it("lands every farm upgrade visibly", () => {
      for (const u of farmUpgrades) {
        const landed =
          calloutFor({ id: 1, upgradeId: u.id, n: 1 } as never, farmInfo) !==
          null;
        expect([u.id, landed || CAPTION_ONLY.has(u.id)]).toEqual([u.id, true]);
      }
    });

    it("has no farm callout for an upgrade outside the farm shop", () => {
      const ids = new Set(farmUpgrades.map((u) => u.id));
      expect(FARM_CALLOUT_IDS.filter((id) => !ids.has(id))).toEqual([]);
    });

    it("keeps every farm callout inside the picture", () => {
      for (const id of FARM_CALLOUT_IDS) {
        for (const n of [1, 4, 8, 12]) {
          const c = calloutFor({ upgradeId: id, n }, farmInfo);
          expect(c?.x).toBeGreaterThanOrEqual(0);
          expect(c?.x).toBeLessThanOrEqual(400);
          expect(c?.y).toBeGreaterThanOrEqual(0);
          expect(c?.y).toBeLessThanOrEqual(300);
        }
      }
    });
  });

  describe("world", () => {
    const worldInfo = sceneInfo(runAtPhaseStart(2));
    const worldUpgrades = def.upgrades.filter((u) =>
      u.phases?.includes("world")
    );

    it("lands every world upgrade visibly", () => {
      for (const u of worldUpgrades) {
        const landed =
          calloutFor({ id: 1, upgradeId: u.id, n: 1 } as never, worldInfo) !==
          null;
        expect([u.id, landed || CAPTION_ONLY.has(u.id)]).toEqual([u.id, true]);
      }
    });

    it("has no world callout for an upgrade outside the world shop", () => {
      const ids = new Set(worldUpgrades.map((u) => u.id));
      expect(WORLD_CALLOUT_IDS.filter((id) => !ids.has(id))).toEqual([]);
    });

    it("keeps every world callout inside the picture", () => {
      for (const id of WORLD_CALLOUT_IDS) {
        for (const n of [1, 4, 8, 12]) {
          const c = calloutFor({ upgradeId: id, n }, worldInfo);
          expect(c?.x).toBeGreaterThanOrEqual(0);
          expect(c?.x).toBeLessThanOrEqual(400);
          expect(c?.y).toBeGreaterThanOrEqual(0);
          expect(c?.y).toBeLessThanOrEqual(300);
        }
      }
    });
  });

  describe("last seed", () => {
    const seedInfo = sceneInfo(runAtPhaseStart(3));
    const seedUpgrades = def.upgrades.filter((u) => u.phases?.includes("seed"));

    it("lands every seed upgrade visibly", () => {
      expect(seedUpgrades.length).toBeGreaterThan(0);
      for (const u of seedUpgrades) {
        const landed =
          calloutFor({ id: 1, upgradeId: u.id, n: 1 } as never, seedInfo) !==
          null;
        expect([u.id, landed || CAPTION_ONLY.has(u.id)]).toEqual([u.id, true]);
      }
    });

    it("has no seed callout for an upgrade outside the window box shop", () => {
      const ids = new Set(seedUpgrades.map((u) => u.id));
      expect(SEED_CALLOUT_IDS.filter((id) => !ids.has(id))).toEqual([]);
    });

    it("keeps every seed callout inside the picture", () => {
      for (const id of SEED_CALLOUT_IDS) {
        for (const n of [1, 4, 8]) {
          const c = calloutFor({ upgradeId: id, n }, seedInfo);
          expect(c?.x).toBeGreaterThanOrEqual(0);
          expect(c?.x).toBeLessThanOrEqual(400);
          expect(c?.y).toBeGreaterThanOrEqual(0);
          expect(c?.y).toBeLessThanOrEqual(300);
        }
      }
    });
  });

  it("lands every Grow upgrade in every phase (the full sweep)", () => {
    const infos = [0, 1, 2, 3].map((i) => sceneInfo(runAtPhaseStart(i)));
    for (const u of def.upgrades) {
      for (const phase of u.phases ?? []) {
        const info = infos.find((x) => x.phase === phase);
        if (!info) continue;
        const landed =
          calloutFor({ id: 1, upgradeId: u.id, n: 1 } as never, info) !== null;
        expect([phase, u.id, landed || CAPTION_ONLY.has(u.id)]).toEqual([
          phase,
          u.id,
          true,
        ]);
      }
    }
  });
});
