import { newProgress } from "../../economy/progress";
import { dailyFor, utcDateKey } from "../../daily/daily";
import { encodeGhost } from "../../ghost/ghost";
import { LEVELS } from "../../levels";
import type { FlightResult } from "../../sim/flight";
import { usePlaneBuilderStore as store } from "../store";

beforeEach(() => store.setState(store.getInitialState(), true));

const NOW = Date.parse("2026-10-30T12:00:00Z");
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
