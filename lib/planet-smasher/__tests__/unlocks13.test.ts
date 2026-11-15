import { POP_H, POP_W, gridFromLuminance } from "../population";
import { PLANETS, PLANET_ORDER } from "../planets";
import { PROGRESS_KEY, freshProgress, loadProgress } from "../progress";
import { useGameStore } from "../store";
import { TOOL_ORDER } from "../tools";
import {
  LEGACY_UNLOCK_PATH_1_2,
  UNLOCK_PATH,
  isUnlocked,
  nextUnlock,
  ownedKey,
  unlocksBetween,
} from "../unlocks";

const grid = gridFromLuminance(new Array(POP_W * POP_H).fill(1), POP_W, POP_H);

const saveOld = (data: Record<string, unknown>) =>
  window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(data));

const legacyAt = (points: number) =>
  LEGACY_UNLOCK_PATH_1_2.filter((e) => e.at <= points).map((e) =>
    ownedKey(e.item)
  );

beforeEach(() => {
  window.localStorage.clear();
});

describe("1.3 star path", () => {
  it("is strictly ascending", () => {
    for (let i = 1; i < UNLOCK_PATH.length; i++) {
      expect(UNLOCK_PATH[i].at).toBeGreaterThan(UNLOCK_PATH[i - 1].at);
    }
  });

  it("has the 19 tools but the asteroid, and 5 planets besides Earth", () => {
    const tools = UNLOCK_PATH.filter((e) => e.item.kind === "tool").map(
      (e) => e.item.id
    );
    expect(tools).toHaveLength(19);
    expect(new Set(tools)).toEqual(
      new Set(TOOL_ORDER.filter((id) => id !== "asteroid"))
    );
    const planets = UNLOCK_PATH.filter((e) => e.item.kind === "planet").map(
      (e) => e.item.id
    );
    expect(new Set(planets)).toEqual(
      new Set(["lava", "mars", "candy", "ice", "ocean"])
    );
    expect(UNLOCK_PATH).toHaveLength(24);
  });

  it("starts with the meteor shower and puts nukes and aliens early", () => {
    expect(nextUnlock(0)?.item).toEqual({ kind: "tool", id: "meteorShower" });
    const index = (id: string) =>
      UNLOCK_PATH.findIndex((e) => e.item.id === id);
    expect(index("nuke")).toBeLessThan(5);
    expect(index("alienLaser")).toBeLessThan(5);
  });

  it("knows the new planets", () => {
    expect(PLANET_ORDER).toEqual([
      "earth",
      "lava",
      "mars",
      "candy",
      "ice",
      "ocean",
    ]);
    expect(PLANETS.lava.name).toBe("Magmar");
    expect(PLANETS.candy.population).toBe(2_500_000_000);
    expect(PLANETS.ocean.peopleIcon).toBe("🐙");
  });

  it("does not toast an item the save already owns", () => {
    const first = UNLOCK_PATH[0];
    expect(unlocksBetween(0, first.at)).toHaveLength(1);
    expect(unlocksBetween(0, first.at, [ownedKey(first.item)])).toHaveLength(0);
  });
});

describe("keeping owned unlocks", () => {
  it("a fresh save owns nothing", () => {
    expect(freshProgress().owned).toEqual([]);
    expect(loadProgress(null).owned).toEqual([]);
  });

  it("a 1.2 save with 13,000 points keeps everything it had, with no toasts", () => {
    saveOld({
      points: 13000,
      endingsSeen: ["shatter"],
      planetId: "ice",
      toolId: "mothership",
    });
    useGameStore.getState().init(grid);
    const s = useGameStore.getState();
    expect(s.lastUnlocks).toEqual([]);
    expect(s.progress.owned).toEqual(legacyAt(13000));
    expect(s.progress.toolId).toBe("mothership");
    expect(s.progress.planetId).toBe("ice");
    for (const e of LEGACY_UNLOCK_PATH_1_2.filter((x) => x.at <= 13000)) {
      expect(isUnlocked(e.item, 0, s.progress.owned)).toBe(true);
    }
  });

  it("a 1.2 save at the end of the old path keeps all 20 tools and the planets", () => {
    saveOld({ points: 20000, planetId: "mars", toolId: "planetCollision" });
    useGameStore.getState().init(grid);
    const { owned } = useGameStore.getState().progress;
    expect(owned).toHaveLength(21);
    for (const id of TOOL_ORDER.filter((t) => t !== "asteroid")) {
      expect(owned).toContain(`tool:${id}`);
    }
    expect(owned).toContain("planet:mars");
    expect(owned).toContain("planet:ice");
    expect(useGameStore.getState().lastUnlocks).toEqual([]);
  });

  it("a 1.2 save with 500 points keeps exactly what it had at 500", () => {
    saveOld({ points: 500, planetId: "earth", toolId: "nuke" });
    useGameStore.getState().init(grid);
    const s = useGameStore.getState();
    expect(s.progress.owned).toEqual([
      "tool:meteorShower",
      "tool:megaBomb",
      "tool:nuke",
    ]);
    expect(s.progress.toolId).toBe("nuke");
  });

  it("an owned tool stays open even when the new path asks for more", () => {
    // The 1.2 earthquake was 1,000; it is further out now.
    const quake = UNLOCK_PATH.find((e) => e.item.id === "earthquake")!;
    expect(quake.at).toBeGreaterThan(1000);
    saveOld({ points: 1000, planetId: "earth", toolId: "earthquake" });
    useGameStore.getState().init(grid);
    const s = useGameStore.getState();
    expect(s.progress.toolId).toBe("earthquake");
    s.selectTool("megaBomb");
    s.selectTool("earthquake");
    expect(useGameStore.getState().progress.toolId).toBe("earthquake");
  });

  it("a crossed threshold adds the item to owned", () => {
    useGameStore.getState().init(grid);
    useGameStore.setState((s) => ({
      progress: { ...s.progress, points: UNLOCK_PATH[0].at - 1 },
    }));
    // Moon ram ends the planet, which pays well past the first threshold.
    useGameStore.getState().hit("moonRam", 0.5, 0.5);
    const s = useGameStore.getState();
    expect(s.progress.owned).toContain(ownedKey(UNLOCK_PATH[0].item));
    expect(s.lastUnlocks[0]).toEqual(UNLOCK_PATH[0].item);
  });
});
