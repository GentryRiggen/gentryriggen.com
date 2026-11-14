import { POP_H, POP_W, gridFromLuminance } from "../population";
import { FIRST_ENDING_BONUS, PROGRESS_KEY } from "../progress";
import { useGameStore } from "../store";

const grid = gridFromLuminance(new Array(POP_W * POP_H).fill(1), POP_W, POP_H);

beforeEach(() => {
  window.localStorage.clear();
  useGameStore.getState().init(grid);
});

describe("game store", () => {
  it("adds the first-ending bonus once", () => {
    const r1 = useGameStore.getState().hit("moonRam", 0.5, 0.5);
    expect(r1.ending).toBe("shatter");
    expect(useGameStore.getState().phase).toBe("ending");
    expect(useGameStore.getState().progress.points).toBe(
      r1.points + FIRST_ENDING_BONUS
    );
    expect(useGameStore.getState().progress.endingsSeen).toEqual(["shatter"]);

    useGameStore.getState().endingShown();
    expect(useGameStore.getState().phase).toBe("ended");
    useGameStore.getState().newPlanet(grid);
    expect(useGameStore.getState().phase).toBe("playing");

    const before = useGameStore.getState().progress.points;
    const r2 = useGameStore.getState().hit("moonRam", 0.5, 0.5);
    expect(useGameStore.getState().progress.points).toBe(before + r2.points);
  });

  it("ignores hits while the ending plays", () => {
    useGameStore.getState().hit("moonRam", 0.5, 0.5);
    const points = useGameStore.getState().progress.points;
    const r = useGameStore.getState().hit("asteroid", 0.5, 0.5);
    expect(r).toEqual({
      peopleLost: 0,
      healthLost: 0,
      points: 0,
      ending: null,
    });
    expect(useGameStore.getState().progress.points).toBe(points);
  });

  it("ignores locked tools and planets", () => {
    useGameStore.getState().selectTool("nuke");
    expect(useGameStore.getState().progress.toolId).toBe("asteroid");
    useGameStore.getState().selectPlanet("mars", grid);
    expect(useGameStore.getState().progress.planetId).toBe("earth");
  });

  it("tracks lastHit, unlocks and saves", () => {
    const first = useGameStore.getState().planet;
    const r = useGameStore.getState().hit("asteroid", 0.3, 0.4);
    const s = useGameStore.getState();
    expect(s.planet).not.toBe(first);
    expect(s.lastHit?.seq).toBe(1);
    expect(s.lastHit?.peopleLost).toBe(r.peopleLost);
    expect(s.progress.points).toBe(r.points);

    const big = useGameStore.getState().hit("moonRam", 0.1, 0.5);
    expect(useGameStore.getState().lastUnlocks.length).toBeGreaterThan(0);
    expect(
      JSON.parse(window.localStorage.getItem(PROGRESS_KEY) ?? "{}").points
    ).toBe(r.points + big.points + FIRST_ENDING_BONUS);
    useGameStore.getState().clearUnlocks();
    expect(useGameStore.getState().lastUnlocks).toEqual([]);
  });
});
