import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as auth from "@/lib/leaderboard/auth";
import * as daily from "@/lib/leaderboard/daily";
import type { LeaderboardRow } from "@/lib/leaderboard/types";
import { newProgress } from "@/lib/plane-builder/economy/progress";
import { usePlaneBuilderStore } from "@/lib/plane-builder/state/store";
import type { FlightSummary } from "@/lib/plane-builder/state/store";
import FlightRewardModal from "../FlightRewardModal";

jest.mock("canvas-confetti", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("@/lib/leaderboard/auth");
jest.mock("@/lib/leaderboard/daily", () => ({
  ...jest.requireActual("@/lib/leaderboard/daily"),
  fetchDailyBoard: jest.fn(),
}));
jest.mock("@/lib/plane-builder/state/leaderboardSync", () => ({
  LEADERBOARDS_ENABLED: true,
  requestLeaderboardSubmit: jest.fn(),
}));

const mockAuth = jest.mocked(auth);
const mockDaily = jest.mocked(daily);

const DATE = "2026-10-30";
const row = (uid: string, value: number): LeaderboardRow => ({
  uid,
  nickname: `P ${uid}`,
  value,
});

const finishedFlight: FlightSummary = {
  result: {
    distance: 2000,
    coins: 5,
    rings: 0,
    finished: true,
    finishTime: 40.04,
    endReason: "runout",
  },
  payout: {
    distancePay: 0,
    coinPay: 0,
    landingBonus: 0,
    milestoneBonus: 0,
    multiplier: 1,
    total: 0,
  },
  isNewBest: false,
  previousBest: 0,
  unlocked: null,
  bonus: null,
  seen: false,
};

const crashedFlight: FlightSummary = {
  ...finishedFlight,
  result: {
    ...finishedFlight.result,
    distance: 500,
    finished: false,
    finishTime: null,
    endReason: "crash",
  },
};

function setup(flight: FlightSummary, bestToday: number | null = 40.04) {
  usePlaneBuilderStore.setState({
    screen: "hangar",
    levelId: "meadow",
    daily: { date: DATE, world: "meadow", twist: "tailwind" },
    isBoardHidden: false,
    lastFlight: flight,
    progress: {
      ...newProgress(),
      dailyBest:
        bestToday === null
          ? null
          : {
              date: DATE,
              time: bestToday,
              ghost: { time: bestToday, data: [] },
            },
    },
  });
}

function Connected({ leaderboardsEnabled }: { leaderboardsEnabled?: boolean }) {
  const lastFlight = usePlaneBuilderStore((s) => s.lastFlight);
  return lastFlight && !lastFlight.seen ? (
    <FlightRewardModal
      levelId="meadow"
      flight={lastFlight}
      leaderboardsEnabled={leaderboardsEnabled}
    />
  ) : null;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.getIdToken.mockResolvedValue({ uid: "me", idToken: "t" });
  mockDaily.fetchDailyBoard.mockResolvedValue([
    row("a", 30),
    row("me", 45),
    row("b", 50),
  ]);
});

afterEach(() => {
  usePlaneBuilderStore.setState({ daily: null, lastFlight: null });
});

describe("FlightRewardModal on a daily run", () => {
  it("explains why there are no coins, with no gauge, jackpot or total", async () => {
    setup(finishedFlight);
    render(<Connected />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(
      "Daily challenge: no coins today, just your best time"
    );
    expect(dialog).not.toHaveTextContent("Coins earned");
    expect(dialog).not.toHaveTextContent("Jackpot");
    expect(dialog).not.toHaveTextContent("Total");
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Stop!" })
    ).not.toBeInTheDocument();
    await act(async () => {});
  });

  it("shows the run's time and today's rank from the daily board", async () => {
    setup(finishedFlight);
    render(<Connected />);
    expect(screen.getByTestId("daily-run-time")).toHaveTextContent("40.0 s");
    expect(await screen.findByText("#2 today")).toBeVisible();
    expect(mockDaily.fetchDailyBoard).toHaveBeenCalledWith(DATE);
  });

  it("ranks today's best, not a slower run", async () => {
    setup(
      {
        ...finishedFlight,
        result: { ...finishedFlight.result, finishTime: 60 },
      },
      40.04
    );
    render(<Connected />);
    expect(screen.getByTestId("daily-run-time")).toHaveTextContent("60.0 s");
    // With 60 s the player would be #3; their best of 40 s holds #2.
    expect(await screen.findByText("#2 today")).toBeVisible();
  });

  it("shows no rank when the board cannot load", async () => {
    mockDaily.fetchDailyBoard.mockResolvedValue(null);
    setup(finishedFlight);
    render(<Connected />);
    await waitFor(() => expect(mockDaily.fetchDailyBoard).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.queryByTestId("daily-run-rank")).not.toBeInTheDocument();
    expect(screen.getByTestId("daily-run-time")).toBeVisible();
  });

  it("shows no rank and fetches nothing while the board is hidden", async () => {
    setup(finishedFlight);
    usePlaneBuilderStore.setState({ isBoardHidden: true });
    render(<Connected />);
    await act(async () => {});
    expect(screen.queryByTestId("daily-run-rank")).not.toBeInTheDocument();
    expect(mockDaily.fetchDailyBoard).not.toHaveBeenCalled();
    expect(mockAuth.getIdToken).not.toHaveBeenCalled();
  });

  it("shows no rank and fetches nothing when leaderboards are off", async () => {
    setup(finishedFlight);
    render(<Connected leaderboardsEnabled={false} />);
    await act(async () => {});
    expect(screen.queryByTestId("daily-run-rank")).not.toBeInTheDocument();
    expect(mockDaily.fetchDailyBoard).not.toHaveBeenCalled();
    expect(mockAuth.getIdToken).not.toHaveBeenCalled();
  });

  it("nudges a crashed run toward the finish", async () => {
    setup(crashedFlight, null);
    render(<Connected />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("500 m");
    expect(dialog).toHaveTextContent("% of the way");
    expect(dialog).toHaveTextContent("Reach the finish to set a time!");
    expect(dialog).toHaveTextContent(
      "Daily challenge: no coins today, just your best time"
    );
    expect(screen.queryByTestId("daily-run-time")).not.toBeInTheDocument();
    await act(async () => {});
    expect(mockDaily.fetchDailyBoard).not.toHaveBeenCalled();
  });

  it("shows the coins on the first finish of the day, which pays", async () => {
    setup({
      ...finishedFlight,
      payout: { ...finishedFlight.payout, distancePay: 80, total: 80 },
    });
    render(<Connected />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Coins earned +80");
    expect(dialog).not.toHaveTextContent("no coins today");
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
    await act(async () => {});
  });

  it("goes straight to a focused Continue that closes it", async () => {
    setup(finishedFlight);
    render(<Connected />);
    const next = screen.getByRole("button", { name: "Continue" });
    expect(next).toHaveFocus();
    await userEvent.click(next);
    expect(usePlaneBuilderStore.getState().lastFlight?.seen).toBe(true);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it.each([" ", "Enter"])("closes on %p when no control has focus", (key) => {
    setup(finishedFlight);
    render(<Connected leaderboardsEnabled={false} />);
    (document.activeElement as HTMLElement | null)?.blur();
    act(() => {
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", { key, bubbles: true })
      );
    });
    expect(usePlaneBuilderStore.getState().lastFlight?.seen).toBe(true);
  });

  it("ignores a Space still held from flying", () => {
    setup(finishedFlight);
    render(<Connected leaderboardsEnabled={false} />);
    const next = screen.getByRole("button", { name: "Continue" });
    const held = new KeyboardEvent("keydown", {
      key: " ",
      repeat: true,
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      next.dispatchEvent(held);
    });
    // Blocking the repeat's default stops the button from clicking on release.
    expect(held.defaultPrevented).toBe(true);
    expect(usePlaneBuilderStore.getState().lastFlight?.seen).toBe(false);
  });
});
