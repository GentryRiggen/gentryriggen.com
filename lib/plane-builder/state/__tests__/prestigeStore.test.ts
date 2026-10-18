import { LEVEL_ORDER } from "../../levels";
import { newProgress, type Progress } from "../../economy/progress";
import { squareAt } from "../../prestige/board";
import { usePlaneBuilderStore as store } from "../store";

beforeEach(() => store.setState(store.getInitialState(), true));

function finishedProgress(): Progress {
  const p = newProgress();
  for (const id of LEVEL_ORDER) p.levels[id].finished = true;
  p.unlocked = [...LEVEL_ORDER];
  return p;
}

describe("prestige in the store", () => {
  it("doPrestige does nothing until the islands are finished", () => {
    store.getState().doPrestige();
    expect(store.getState().screen).toBe("levels");
    expect(store.getState().progress.prestige.level).toBe(0);
  });

  it("doPrestige resets, owes a move and opens the map", () => {
    store.getState().hydrate(finishedProgress());
    store.getState().doPrestige();
    const s = store.getState();
    expect(s.screen).toBe("map");
    expect(s.progress.prestige).toMatchObject({ level: 1, movePending: true });
    expect(s.progress.unlocked).toEqual(["meadow"]);
    // A second tap can't prestige again while the move is owed.
    store.getState().doPrestige();
    expect(store.getState().progress.prestige.level).toBe(1);
  });

  it("move spends the owed move and returns what it collected", () => {
    store.getState().hydrate(finishedProgress());
    store.getState().doPrestige();
    expect(store.getState().move(2, 0)).toBeNull();
    expect(store.getState().progress.prestige.movePending).toBe(true);
    const collected = store.getState().move(1, 0);
    expect(collected).toBe(squareAt(1, 0));
    expect(store.getState().progress.prestige).toMatchObject({
      x: 1,
      movePending: false,
    });
    // No second move.
    expect(store.getState().move(1, 0)).toBeNull();
    expect(store.getState().progress.prestige.x).toBe(1);
  });

  it("openMap shows the map", () => {
    store.getState().openMap();
    expect(store.getState().screen).toBe("map");
  });

  it("routes to the map when a move is still owed on load", () => {
    const p = finishedProgress();
    p.prestige.movePending = true;
    store.getState().hydrate(p);
    expect(store.getState().screen).toBe("map");
  });

  it("won't open a level while a move is owed", () => {
    const p = newProgress();
    p.prestige.movePending = true;
    store.setState({ progress: p });
    store.getState().openLevel("meadow");
    expect(store.getState().screen).toBe("map");
  });

  it("pays out with the coin factor", () => {
    const base = newProgress();
    const rich = newProgress();
    rich.prestige.bonuses.star = 2;
    const flyOnce = (p: Progress) => {
      store.setState(store.getInitialState(), true);
      store.getState().hydrate(p);
      store.getState().openLevel("meadow");
      store.getState().startLaunch();
      store.getState().beginFlight({ pitch: 0.3, yaw: 0, power: 1 });
      store.getState().completeFlight({
        distance: 0,
        coins: 0,
        rings: 0,
        finished: false,
        finishTime: null,
        endReason: "crash",
      });
      return store.getState().lastFlight!.payout.total;
    };
    expect(flyOnce(rich)).toBe(flyOnce(base) * 4);
  });
});
