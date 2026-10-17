import { newProgress } from "../../economy/progress";
import { LEVELS } from "../../levels";
import { tierPrice } from "../../plane/catalog";
import { launchAim } from "../launchAim";
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

  it("goes launch → flight → hangar and pays out", () => {
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
    expect(s.screen).toBe("hangar");
    expect(s.lastFlight?.isNewBest).toBe(true);
    expect(s.progress.levels.meadow.coins).toBe(s.lastFlight!.payout.total);
    s.startLaunch();
    expect(store.getState().screen).toBe("launch");
    expect(store.getState().lastFlight).toBeNull();
    store.getState().beginFlight({ pitch: 0.3, yaw: 0, power: 1 });
    expect(store.getState().flightId).toBe(id + 1);
  });

  it("pays the coin gauge once per flight", () => {
    store.getState().openLevel("meadow");
    store.getState().startLaunch();
    store.getState().beginFlight({ pitch: 0.3, yaw: 0, power: 1 });
    store.getState().completeFlight({
      distance: 300,
      coins: 0,
      rings: 0,
      finished: false,
      endReason: "crash",
    });
    const total = store.getState().lastFlight!.payout.total;
    store.getState().claimCoinBonus("green");
    const s = store.getState();
    expect(s.lastFlight?.bonus).toEqual({
      zone: "green",
      multiplier: 2,
      extra: total,
    });
    expect(s.progress.levels.meadow.coins).toBe(total * 2);
    store.getState().claimCoinBonus("green");
    expect(store.getState().progress.levels.meadow.coins).toBe(total * 2);
  });

  it("dismisses the reward only after the bonus is claimed", () => {
    store.getState().openLevel("meadow");
    store.getState().startLaunch();
    store.getState().beginFlight({ pitch: 0.3, yaw: 0, power: 1 });
    store.getState().completeFlight({
      distance: 300,
      coins: 0,
      rings: 0,
      finished: false,
      endReason: "crash",
    });
    expect(store.getState().lastFlight?.seen).toBe(false);
    store.getState().dismissFlightReward();
    expect(store.getState().lastFlight?.seen).toBe(false);
    store.getState().claimCoinBonus("red");
    store.getState().dismissFlightReward();
    expect(store.getState().lastFlight?.seen).toBe(true);
  });

  it("does nothing for the coin gauge without a flight", () => {
    store.getState().claimCoinBonus("green");
    expect(store.getState().progress.levels.meadow.coins).toBe(0);
  });

  it("restart wipes one level", () => {
    const p = newProgress();
    p.levels.meadow.coins = 99;
    store.getState().hydrate(p);
    store.getState().restart("meadow");
    expect(store.getState().progress.levels.meadow.coins).toBe(0);
  });

  const result = {
    distance: 300,
    coins: 4,
    rings: 0,
    finished: false,
    endReason: "landed",
  } as const;

  it("pays a flight out once, even if completed twice", () => {
    store.getState().openLevel("meadow");
    store.getState().startLaunch();
    store.getState().beginFlight({ pitch: 0.3, yaw: 0, power: 1 });
    const id = store.getState().flightId;
    store.getState().completeFlight(result, id);
    const coins = store.getState().progress.levels.meadow.coins;
    store.getState().completeFlight(result, id);
    expect(store.getState().progress.levels.meadow.coins).toBe(coins);
  });

  it("ignores a completion from a stale flight", () => {
    store.getState().openLevel("meadow");
    store.getState().startLaunch();
    store.getState().beginFlight({ pitch: 0.3, yaw: 0, power: 1 });
    store.getState().completeFlight(result, store.getState().flightId - 1);
    expect(store.getState().screen).toBe("flight");
  });

  it("slackens the slingshot when launching a new flight", () => {
    Object.assign(launchAim, { pitch: 0.4, yaw: 0.2, power: 0.9 });
    store.getState().startLaunch();
    expect(launchAim).toEqual({ pitch: 0, yaw: 0, power: 0 });
    Object.assign(launchAim, { power: 0.8 });
    store.getState().beginFlight({ pitch: 0.3, yaw: 0, power: 0.8 });
    expect(launchAim.power).toBe(0);
  });

  it("resetTransient drops a stale screen", () => {
    store.getState().openLevel("meadow");
    store.getState().startLaunch();
    store.getState().resetTransient();
    expect(store.getState()).toMatchObject({
      screen: "levels",
      aim: null,
      lastFlight: null,
    });
  });
});
