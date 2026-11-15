import { POP_H, POP_W, gridFromLuminance } from "../population";
import { PROGRESS_KEY, loadProgress, saveProgress } from "../progress";
import { FIRST_ENDING_BONUS } from "../progress";
import { useGameStore } from "../store";
import { TROPHY_REWARD } from "../trophies";

const grid = gridFromLuminance(new Array(POP_W * POP_H).fill(1), POP_W, POP_H);
const st = () => useGameStore.getState();

beforeEach(() => {
  window.localStorage.clear();
  st().init(grid);
});

describe("lifetime stats", () => {
  it("counts a shot once per fire id", () => {
    st().hit("asteroid", 0.5, 0.5, 1000, 7);
    st().hit("asteroid", 0.5, 0.5, 1010, 7);
    st().hit("asteroid", 0.2, 0.5, 1020, 8);
    st().hit("asteroid", 0.3, 0.5, 1030);
    st().hit("asteroid", 0.3, 0.5, 1040);
    expect(st().progress.stats.shots.asteroid).toBe(4);
    expect(st().planetRun.toolsUsed).toEqual(["asteroid"]);
    expect(st().progress.stats.peopleLost).toBeGreaterThan(0);
  });

  it("tracks the best combo", () => {
    for (let i = 0; i < 4; i++)
      st().hit("asteroid", 0.1 + i * 0.2, 0.5, 1000 + i * 100, i + 1);
    expect(st().progress.stats.bestCombo).toBe(4);
  });

  it("records an ending and pays each trophy once", () => {
    useGameStore.setState({ planetRun: { toolsUsed: [], startedAt: 1000 } });
    const before = st().progress.points;
    const r = st().hit("blackHole", 0.5, 0.5, 41000, 1);
    const s = st().progress.stats;
    expect(s.planetsEnded).toBe(1);
    expect(s.endedByPlanet.earth).toBe(1);
    expect(s.endedBy.swallowed).toBe(1);
    expect(s.fastestEndMs).toBe(40000);
    // firstSmash and blackHole complete on the same hit.
    expect(st().progress.trophies).toEqual(["firstSmash", "blackHole"]);
    expect(st().lastTrophies).toEqual(["firstSmash", "blackHole"]);
    expect(st().progress.points).toBe(
      before + r.points + FIRST_ENDING_BONUS + 2 * TROPHY_REWARD
    );
    st().clearTrophies();
    expect(st().lastTrophies).toEqual([]);
  });

  it("does not pay again after a reload", () => {
    useGameStore.setState({ planetRun: { toolsUsed: [], startedAt: 0 } });
    st().hit("blackHole", 0.5, 0.5, 41000, 1);
    const points = st().progress.points;
    st().init(grid);
    expect(st().progress.points).toBe(points);
    expect(st().progress.trophies).toHaveLength(2);
    st().hit("asteroid", 0.5, 0.5, 100, 1);
    expect(st().lastTrophies).toEqual([]);
  });

  it("resets the planet run on newPlanet and selectPlanet", () => {
    st().hit("asteroid", 0.5, 0.5, 1000, 1);
    expect(st().planetRun.toolsUsed).toEqual(["asteroid"]);
    st().hit("moonRam", 0.5, 0.5, 1100, 2);
    st().endingShown();
    st().newPlanet(grid);
    expect(st().planetRun.toolsUsed).toEqual([]);
    st().hit("asteroid", 0.5, 0.5, 1000, 3);
    st().selectPlanet("earth", grid);
    expect(st().planetRun.toolsUsed).toEqual([]);
  });

  it("loads a 1.1 save with empty stats, and 10000 points earn stars10k", () => {
    window.localStorage.setItem(
      PROGRESS_KEY,
      JSON.stringify({
        points: 10000,
        endingsSeen: ["shatter"],
        planetId: "earth",
        toolId: "asteroid",
      })
    );
    const p = loadProgress();
    expect(p.stats.planetsEnded).toBe(0);
    expect(p.trophies).toEqual([]);
    st().init(grid);
    expect(st().progress.trophies).toEqual([]);
    st().hit("asteroid", 0.5, 0.5, 1000, 1);
    expect(st().progress.trophies).toContain("stars10k");
  });

  it("round-trips stats through save and load", () => {
    st().hit("asteroid", 0.5, 0.5, 1000, 1);
    saveProgress(st().progress);
    expect(loadProgress().stats.shots.asteroid).toBe(1);
  });
});
