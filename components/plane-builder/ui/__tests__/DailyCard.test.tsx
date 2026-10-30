import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as auth from "@/lib/leaderboard/auth";
import * as daily from "@/lib/leaderboard/daily";
import { dailyFor } from "@/lib/plane-builder/daily/daily";
import { newProgress } from "@/lib/plane-builder/economy/progress";
import { encodeGhost } from "@/lib/plane-builder/ghost/ghost";
import { LEVELS } from "@/lib/plane-builder/levels";
import { usePlaneBuilderStore } from "@/lib/plane-builder/state/store";
import DailyCard from "../DailyCard";
import GhostToggle from "../GhostToggle";
import { ghostSetting } from "../ghostSetting";

jest.mock("@/lib/leaderboard/auth");
jest.mock("@/lib/leaderboard/daily", () => ({
  ...jest.requireActual("@/lib/leaderboard/daily"),
  fetchDailyBoard: jest.fn(),
}));
jest.mock("@/lib/leaderboard/client");
jest.mock("@/lib/plane-builder/state/leaderboardSync", () => ({
  LEADERBOARDS_ENABLED: false,
  requestLeaderboardSubmit: jest.fn(),
}));

const mockAuth = jest.mocked(auth);
const mockDaily = jest.mocked(daily);

const TODAY = "2026-10-30";
const ghost = encodeGhost(
  50,
  Array.from({ length: 4 }, (_, i) => ({
    x: i,
    y: 1,
    z: 0,
    heading: 0,
    pitch: 0,
    bank: 0,
  }))
);

beforeEach(() => {
  jest.useFakeTimers({ now: Date.parse(`${TODAY}T22:30:00Z`) });
  usePlaneBuilderStore.setState(usePlaneBuilderStore.getInitialState(), true);
  mockAuth.getIdToken.mockResolvedValue({ uid: "me", idToken: "t" });
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

describe("DailyCard", () => {
  it("shows today's world and twist, and counts down to the next day", () => {
    render(<DailyCard leaderboardsEnabled={false} />);
    const today = dailyFor(TODAY);
    const card = screen.getByTestId("daily-card");
    expect(within(card).getByText(LEVELS[today.world].name)).toBeVisible();
    expect(screen.getByTestId("daily-countdown")).toHaveTextContent(
      "New one in 1:30:00"
    );
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(screen.getByTestId("daily-countdown")).toHaveTextContent("1:29:55");
  });

  it("shows no time before a finish, and today's best after", () => {
    render(<DailyCard leaderboardsEnabled={false} />);
    expect(screen.getByTestId("daily-best")).toHaveTextContent(
      "No time yet today"
    );
    act(() => {
      usePlaneBuilderStore.setState({
        progress: {
          ...newProgress(),
          dailyBest: { date: TODAY, time: 54.26, ghost },
        },
      });
    });
    expect(screen.getByTestId("daily-best")).toHaveTextContent(
      "Your best today: 54.3 s"
    );
  });

  it("ignores a best from another day", () => {
    usePlaneBuilderStore.setState({
      progress: {
        ...newProgress(),
        dailyBest: { date: "2026-10-29", time: 40, ghost },
      },
    });
    render(<DailyCard leaderboardsEnabled={false} />);
    expect(screen.getByTestId("daily-best")).toHaveTextContent(
      "No time yet today"
    );
  });

  it("opens today's challenge in the hangar", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<DailyCard leaderboardsEnabled={false} />);
    await user.click(screen.getByRole("button", { name: /fly today/i }));
    const state = usePlaneBuilderStore.getState();
    expect(state.screen).toBe("hangar");
    expect(state.daily).toEqual(dailyFor(TODAY));
    expect(state.levelId).toBe(dailyFor(TODAY).world);
  });

  it("has no board button while leaderboards are off", () => {
    render(<DailyCard leaderboardsEnabled={false} />);
    expect(
      screen.queryByRole("button", { name: /daily board/i })
    ).not.toBeInTheDocument();
    expect(mockAuth.getIdToken).not.toHaveBeenCalled();
  });

  it("opens the daily board with the top rows as text and your rank", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    usePlaneBuilderStore.setState({
      progress: {
        ...newProgress(),
        nickname: "Happy Otter 7",
        dailyBest: { date: TODAY, time: 61.2, ghost },
      },
    });
    mockDaily.fetchDailyBoard.mockResolvedValue([
      { uid: "a", nickname: "<b>Ace</b>", value: 55.04 },
      { uid: "me", nickname: "Happy Otter 7", value: 61.2 },
    ]);
    render(<DailyCard leaderboardsEnabled />);
    await user.click(
      await screen.findByRole("button", { name: /daily board/i })
    );
    const dialog = screen.getByRole("dialog");
    expect(mockDaily.fetchDailyBoard).toHaveBeenCalledWith(TODAY);
    expect(await within(dialog).findByText("<b>Ace</b>")).toBeInTheDocument();
    expect(dialog.querySelector("b")).toBeNull();
    expect(within(dialog).getByText("55.0 s")).toBeInTheDocument();
    await waitFor(() =>
      expect(within(dialog).getByTestId("daily-rank")).toHaveTextContent(
        "You're #2 today with 61.2 s!"
      )
    );
  });

  it("tells a pilot outside the top 20 what to beat", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    usePlaneBuilderStore.setState({
      progress: {
        ...newProgress(),
        nickname: "Happy Otter 7",
        dailyBest: { date: TODAY, time: 99, ghost },
      },
    });
    mockDaily.fetchDailyBoard.mockResolvedValue(
      Array.from({ length: 20 }, (_, i) => ({
        uid: `u${i}`,
        nickname: `Pilot ${i}`,
        value: 50 + i,
      }))
    );
    render(<DailyCard leaderboardsEnabled />);
    await user.click(
      await screen.findByRole("button", { name: /daily board/i })
    );
    await waitFor(() =>
      expect(screen.getByTestId("daily-rank")).toHaveTextContent(
        "Beat 69.0 s to join the top 20"
      )
    );
  });
});

describe("GhostToggle", () => {
  beforeEach(() => {
    window.localStorage.clear();
    ghostSetting.resetMemory();
  });

  it("is on by default and turns off and on", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<GhostToggle />);
    const button = screen.getByRole("button", { name: "Ghost plane" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    await user.click(button);
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(ghostSetting.get()).toBe(false);
    await user.click(button);
    expect(ghostSetting.get()).toBe(true);
  });
});
