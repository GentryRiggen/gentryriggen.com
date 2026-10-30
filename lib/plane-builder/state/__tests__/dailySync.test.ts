import { newProgress } from "../../economy/progress";
import { dailyFor } from "../../daily/daily";
import { encodeGhost } from "../../ghost/ghost";
import { startDailySync } from "../dailySync";
import { usePlaneBuilderStore as store } from "../store";

const NOW = Date.parse("2026-10-30T12:00:00Z");
const ghost = encodeGhost(
  40,
  Array.from({ length: 4 }, (_, i) => ({
    x: i,
    y: 1,
    z: 0,
    heading: 0,
    pitch: 0,
    bank: 0,
  }))
);

beforeEach(() => store.setState(store.getInitialState(), true));

const withBest = (date: string, time: number) => {
  const p = newProgress();
  p.nickname = "Happy Otter 7";
  p.dailyBest = { date, time, ghost };
  return p;
};
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("startDailySync", () => {
  it("does nothing when disabled", async () => {
    const submit = jest.fn().mockResolvedValue(true);
    store.getState().hydrate(withBest("2026-10-30", 40));
    startDailySync({ enabled: false, submit, now: () => NOW })();
    await flush();
    expect(submit).not.toHaveBeenCalled();
  });

  it("sends today's stored best once at start", async () => {
    const submit = jest.fn().mockResolvedValue(true);
    store.getState().hydrate(withBest("2026-10-30", 40));
    const stop = startDailySync({ enabled: true, submit, now: () => NOW });
    await flush();
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith("2026-10-30", {
      nickname: "Happy Otter 7",
      world: dailyFor("2026-10-30").world,
      time: 40,
    });
    stop();
  });

  it("sends again when the best improves, and stops when stopped", async () => {
    const submit = jest.fn().mockResolvedValue(true);
    store.getState().hydrate(withBest("2026-10-30", 40));
    const stop = startDailySync({ enabled: true, submit, now: () => NOW });
    store.getState().hydrate(withBest("2026-10-30", 38));
    await flush();
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1][1].time).toBe(38);
    stop();
    store.getState().hydrate(withBest("2026-10-30", 30));
    await flush();
    expect(submit).toHaveBeenCalledTimes(2);
  });

  it("skips a best from an older day", async () => {
    const submit = jest.fn().mockResolvedValue(true);
    store.getState().hydrate(withBest("2026-10-27", 40));
    startDailySync({ enabled: true, submit, now: () => NOW })();
    await flush();
    expect(submit).not.toHaveBeenCalled();
  });

  it("survives a failing submit", async () => {
    const submit = jest.fn().mockRejectedValue(new Error("offline"));
    store.getState().hydrate(withBest("2026-10-30", 40));
    startDailySync({ enabled: true, submit, now: () => NOW })();
    await flush();
    expect(submit).toHaveBeenCalled();
  });
});
