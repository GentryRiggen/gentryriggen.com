import { newProgress } from "../../economy/progress";
import { dailyFor, utcDateKey } from "../../daily/daily";
import { encodeGhost } from "../../ghost/ghost";
import { LEVELS } from "../../levels";
import type { FlightResult } from "../../sim/flight";
import { usePlaneBuilderStore as store } from "../store";

const NOW = Date.parse("2026-10-30T12:00:00Z");

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  store.setState(store.getInitialState(), true);
});
afterEach(() => jest.useRealTimers());

const ghost = encodeGhost(
  40,
  Array.from({ length: 10 }, (_, i) => ({
    x: i * 8,
    y: 5,
    z: 0,
    heading: 0,
    pitch: 0,
    bank: 0,
  }))
);
const finished = (time: number): FlightResult => ({
  distance: LEVELS.meadow.finishDistance,
  coins: 10,
  rings: 0,
  finished: true,
  finishTime: time,
  endReason: "runout",
});

function flyDaily(result: FlightResult, withGhost = ghost) {
  store.getState().openDaily(NOW);
  store.getState().startLaunch();
  store.getState().beginFlight({ pitch: 0.3, yaw: 0, power: 1 });
  store.getState().completeFlight(result, undefined, withGhost);
}

describe("daily challenge in the store", () => {
  it("opens today's world, even a locked one", () => {
    store.getState().openDaily(NOW);
    const today = dailyFor(utcDateKey(NOW));
    expect(store.getState()).toMatchObject({
      screen: "hangar",
      levelId: today.world,
      daily: today,
    });
  });

  it("leaves the daily when going back or opening a normal world", () => {
    store.getState().openDaily(NOW);
    store.getState().goToLevels();
    expect(store.getState().daily).toBeNull();
    store.getState().openDaily(NOW);
    store.getState().openLevel("meadow");
    expect(store.getState().daily).toBeNull();
  });

  it("records today's best but not the world's own records", () => {
    const { world } = dailyFor(utcDateKey(NOW));
    store.getState().openDaily(NOW);
    store.setState({ levelId: world });
    flyDaily({ ...finished(40), distance: LEVELS[world].finishDistance });
    const { progress, lastFlight } = store.getState();
    expect(progress.dailyBest).toMatchObject({
      date: "2026-10-30",
      time: 40,
    });
    expect(progress.bestTimes).toEqual({});
    expect(progress.ghosts).toEqual({});
    expect(progress.levels[world].best).toBe(0);
    expect(lastFlight?.isNewBest).toBe(false);
    expect(lastFlight?.unlocked).toBeNull();
  });

  it("keeps the daily after a flight, for one more go", () => {
    flyDaily(finished(40));
    expect(store.getState().daily).not.toBeNull();
    expect(store.getState().screen).toBe("hangar");
  });

  it("does not celebrate a first finish on the daily", () => {
    flyDaily(finished(40));
    store.getState().claimCoinBonus("red");
    store.getState().dismissFlightReward();
    expect(store.getState().screen).toBe("hangar");
    expect(store.getState().celebrate).toBeNull();
  });

  it("closes a daily flight's reward without a coin bonus", () => {
    flyDaily(finished(40));
    store.getState().dismissFlightReward();
    expect(store.getState().lastFlight?.seen).toBe(true);
    expect(store.getState().lastFlight?.bonus).toBeNull();
    expect(store.getState().screen).toBe("hangar");
  });

  it("still needs the coin bonus to close a normal flight's reward", () => {
    store.getState().openLevel("meadow");
    store.getState().startLaunch();
    store.getState().beginFlight({ pitch: 0.3, yaw: 0, power: 1 });
    store.getState().completeFlight(finished(40), undefined, ghost);
    store.getState().dismissFlightReward();
    expect(store.getState().lastFlight?.seen).toBe(false);
  });
});

describe("daily coins and the day rolling over", () => {
  const coinsOf = () => {
    const { levelId, progress } = store.getState();
    return progress.levels[levelId].coins;
  };

  it("pays only the first finish of the day", () => {
    flyDaily(finished(40));
    const first = coinsOf();
    expect(first).toBeGreaterThan(0);
    // A second, faster finish still sets the time but pays nothing.
    store.getState().startLaunch();
    store.getState().beginFlight({ pitch: 0.3, yaw: 0, power: 1 });
    store.getState().completeFlight(finished(35), undefined, ghost);
    expect(coinsOf()).toBe(first);
    expect(store.getState().progress.dailyBest?.time).toBe(35);
  });

  it("pays nothing for a flight that did not finish", () => {
    flyDaily({ ...finished(40), finished: false, finishTime: null });
    expect(coinsOf()).toBe(0);
    expect(store.getState().progress.dailyBest).toBeNull();
  });

  it("records nothing for a flight that ends after midnight", () => {
    store.getState().openDaily(NOW);
    store.getState().startLaunch();
    store.getState().beginFlight({ pitch: 0.3, yaw: 0, power: 1 });
    jest.setSystemTime(Date.parse("2026-10-31T00:00:05Z"));
    store.getState().completeFlight(finished(40), undefined, ghost);
    expect(store.getState().progress.dailyBest).toBeNull();
    expect(coinsOf()).toBe(0);
  });

  it("sends the player back to the worlds screen when launching a stale daily", () => {
    store.getState().openDaily(NOW);
    jest.setSystemTime(Date.parse("2026-10-31T00:00:05Z"));
    store.getState().startLaunch();
    expect(store.getState()).toMatchObject({ screen: "levels", daily: null });
  });

  it("leaves the daily when opening the Sky Map", () => {
    store.getState().openDaily(NOW);
    store.getState().openMap();
    expect(store.getState().daily).toBeNull();
  });
});

describe("ghosts in the store", () => {
  it("keeps the ghost of a new best time on a normal flight", () => {
    store.getState().hydrate(newProgress());
    store.getState().openLevel("meadow");
    store.getState().startLaunch();
    store.getState().beginFlight({ pitch: 0.3, yaw: 0, power: 1 });
    store.getState().completeFlight(finished(40), undefined, ghost);
    expect(store.getState().progress.ghosts.meadow).toEqual(ghost);
  });
});
