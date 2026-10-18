import { isValidNickname } from "@/lib/leaderboard/nickname";
import type { LeaderboardEntry } from "@/lib/leaderboard/types";
import { newProgress } from "../../economy/progress";
import { createLeaderboardSync } from "../leaderboardSync";
import { usePlaneBuilderStore } from "../store";

jest.mock("@/lib/leaderboard/client", () => ({ submitEntry: jest.fn() }));

const flight = () => ({ result: {}, payout: {}, seen: false }) as never;

beforeEach(() => {
  jest.useFakeTimers();
  usePlaneBuilderStore.setState({
    progress: { ...newProgress(), lifetimeDistance: 1500 },
    lastFlight: null,
  });
});
afterEach(() => jest.useRealTimers());

function setup(submit: jest.Mock) {
  return createLeaderboardSync({
    enabled: true,
    submit,
    now: () => Date.now(),
  }).start();
}

it("sends the first flight at once with a generated nickname and score", () => {
  const submit = jest.fn().mockResolvedValue(true);
  const stop = setup(submit);
  usePlaneBuilderStore.setState({ lastFlight: flight() });
  expect(submit).toHaveBeenCalledTimes(1);
  const entry = submit.mock.calls[0][0] as LeaderboardEntry;
  expect(isValidNickname(entry.nickname)).toBe(true);
  expect(entry.score).toBe(1500);
  stop();
});

it("sends at most once per 30 s, with a trailing submit of the latest data", () => {
  const submit = jest.fn().mockResolvedValue(true);
  const stop = setup(submit);
  usePlaneBuilderStore.setState({ lastFlight: flight() });
  jest.advanceTimersByTime(10_000);
  usePlaneBuilderStore.setState({ lastFlight: flight() });
  usePlaneBuilderStore.setState((s) => ({
    lastFlight: flight(),
    progress: { ...s.progress, lifetimeDistance: 9000 },
  }));
  expect(submit).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(19_999);
  expect(submit).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(1);
  expect(submit).toHaveBeenCalledTimes(2);
  expect((submit.mock.calls[1][0] as LeaderboardEntry).score).toBe(9000);
  stop();
});

it("submits on prestige", () => {
  const submit = jest.fn().mockResolvedValue(true);
  const stop = setup(submit);
  usePlaneBuilderStore.setState((s) => ({
    progress: {
      ...s.progress,
      prestige: { ...s.progress.prestige, level: 1 },
    },
  }));
  expect(submit).toHaveBeenCalledTimes(1);
  expect((submit.mock.calls[0][0] as LeaderboardEntry).prestige).toBe(1);
  stop();
});

it("never throws when the submit fails", async () => {
  const submit = jest.fn().mockRejectedValue(new Error("offline"));
  const stop = setup(submit);
  expect(() =>
    usePlaneBuilderStore.setState({ lastFlight: flight() })
  ).not.toThrow();
  await Promise.resolve();
  stop();
});

it("does nothing when disabled", () => {
  const submit = jest.fn();
  const stop = createLeaderboardSync({ enabled: false, submit }).start();
  usePlaneBuilderStore.setState({ lastFlight: flight() });
  expect(submit).not.toHaveBeenCalled();
  stop();
});

it("setNickname only accepts generated names", () => {
  usePlaneBuilderStore.getState().setNickname("Happy Otter 7");
  expect(usePlaneBuilderStore.getState().progress.nickname).toBe(
    "Happy Otter 7"
  );
  usePlaneBuilderStore.getState().setNickname("anything goes");
  expect(usePlaneBuilderStore.getState().progress.nickname).toBe(
    "Happy Otter 7"
  );
});
