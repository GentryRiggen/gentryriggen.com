import { flightResult, runFlight, type LaunchAim } from "../flight";
import { POWERED, flatLevel } from "./fixtures";

const AIM: LaunchAim = { pitch: 0.2, yaw: 0, power: 1 };
const hands = () => ({ pitch: 0, bank: 0, boost: false });

describe("finishTime", () => {
  it("is null when the finish is never reached", () => {
    const level = flatLevel({ finishDistance: 1e9 });
    const { state } = runFlight(level, { ...POWERED, fuel: 0 }, AIM, hands);
    expect(state.finished).toBe(false);
    expect(flightResult(state, level).finishTime).toBeNull();
  });

  it("is the sim time the finish was crossed, not the end of the flight", () => {
    const level = flatLevel({ finishDistance: 60 });
    const { state } = runFlight(level, POWERED, AIM, hands);
    expect(state.finished).toBe(true);
    const { finishTime } = flightResult(state, level);
    expect(finishTime).not.toBeNull();
    expect(finishTime!).toBeGreaterThan(0);
    expect(finishTime!).toBeLessThanOrEqual(state.time);
  });
});
