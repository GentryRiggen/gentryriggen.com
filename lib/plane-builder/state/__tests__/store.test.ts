import { newProgress } from "../../economy/progress";
import { LEVELS } from "../../levels";
import { tierPrice } from "../../plane/catalog";
import { usePlaneBuilderStore as store } from "../store";

const reset = () => store.setState(store.getInitialState(), true);
beforeEach(reset);

describe("plane builder store", () => {
  it("starts on level select", () => {
    expect(store.getState().screen).toBe("levels");
  });

  it("opens an unlocked level's hangar but not a locked one", () => {
    store.getState().openLevel("canyon");
    expect(store.getState().screen).toBe("levels");
    store.getState().openLevel("meadow");
    expect(store.getState()).toMatchObject({
      screen: "hangar",
      levelId: "meadow",
    });
  });

  it("buys from the current level's wallet", () => {
    const p = newProgress();
    p.levels.meadow.coins = 1000;
    store.getState().hydrate(p);
    store.getState().openLevel("meadow");
    expect(store.getState().buy("wings").ok).toBe(true);
    expect(store.getState().progress.levels.meadow.coins).toBe(
      1000 - tierPrice(LEVELS.meadow.plane.wings, 0)!
    );
  });

  it("goes launch → flight → results and pays out", () => {
    store.getState().openLevel("meadow");
    store.getState().startLaunch();
    expect(store.getState().screen).toBe("launch");
    store.getState().beginFlight({ pitch: 0.3, yaw: 0, power: 1 });
    expect(store.getState().screen).toBe("flight");
    const id = store.getState().flightId;
    store.getState().completeFlight({
      distance: 300,
      coins: 4,
      rings: 0,
      finished: false,
      endReason: "landed",
    });
    const s = store.getState();
    expect(s.screen).toBe("results");
    expect(s.lastFlight?.isNewBest).toBe(true);
    expect(s.progress.levels.meadow.coins).toBe(s.lastFlight!.payout.total);
    s.flyAgain();
    expect(store.getState().screen).toBe("launch");
    store.getState().beginFlight({ pitch: 0.3, yaw: 0, power: 1 });
    expect(store.getState().flightId).toBe(id + 1);
  });

  it("restart wipes one level", () => {
    const p = newProgress();
    p.levels.meadow.coins = 99;
    store.getState().hydrate(p);
    store.getState().restart("meadow");
    expect(store.getState().progress.levels.meadow.coins).toBe(0);
  });
});
