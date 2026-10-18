import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as auth from "@/lib/leaderboard/auth";
import * as board from "@/lib/leaderboard/client";
import type { LeaderboardRow } from "@/lib/leaderboard/types";
import { newProgress } from "@/lib/plane-builder/economy/progress";
import { usePlaneBuilderStore } from "@/lib/plane-builder/state/store";
import type { FlightSummary } from "@/lib/plane-builder/state/store";
import FlightRewardModal from "../FlightRewardModal";

jest.mock("canvas-confetti", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("@/lib/leaderboard/auth");
jest.mock("@/lib/leaderboard/client");
jest.mock("@/lib/plane-builder/state/leaderboardSync", () => ({
  LEADERBOARDS_ENABLED: true,
  requestLeaderboardSubmit: jest.fn(),
}));

const mockAuth = jest.mocked(auth);
const mockBoard = jest.mocked(board);

const row = (uid: string, nickname: string, value: number): LeaderboardRow => ({
  uid,
  nickname,
  value,
});

const flight: FlightSummary = {
  result: {
    distance: 1000,
    coins: 5,
    rings: 0,
    finished: true,
    finishTime: 20,
    endReason: "landed",
  },
  payout: {
    distancePay: 60,
    coinPay: 5,
    landingBonus: 0,
    milestoneBonus: 0,
    multiplier: 1,
    total: 65,
  },
  isNewBest: true,
  previousBest: 0,
  unlocked: null,
  bonus: { zone: "green", multiplier: 2, extra: 65 },
  seen: false,
};

function setBestTime(seconds: number | null) {
  usePlaneBuilderStore.setState({
    progress: {
      ...newProgress(),
      nickname: "Me Pilot 1",
      bestTimes: seconds === null ? {} : { meadow: seconds },
    },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  setBestTime(20);
  mockAuth.getIdToken.mockResolvedValue({ uid: "me", idToken: "t" });
});

const renderModal = () =>
  render(<FlightRewardModal levelId="meadow" flight={flight} />);

it("names who you passed", async () => {
  mockBoard.fetchBoard.mockResolvedValue([
    row("a", "Ace 1", 10),
    row("b", "Zippy Fox 3", 21),
    row("c", "Slow Owl", 22),
    row("d", "Old Crow", 23),
    row("me", "Me Pilot 1", 30),
  ]);
  renderModal();
  expect(await screen.findByText("🥈 #2 on Backyard Meadow!")).toBeVisible();
  expect(screen.getByText("You passed Zippy Fox 3 +2 more!")).toBeVisible();
});

it("shows the gap to the rival when nobody was passed", async () => {
  mockBoard.fetchBoard.mockResolvedValue([
    row("a", "Ace 1", 10),
    row("b", "Zippy Fox 3", 18.4),
    row("me", "Me Pilot 1", 20),
  ]);
  renderModal();
  expect(await screen.findByText("🥉 #3 on Backyard Meadow!")).toBeVisible();
  expect(screen.getByText("1.6 s faster to pass Zippy Fox 3")).toBeVisible();
});

it("shows the gap to the top 50 when off the board", async () => {
  mockBoard.fetchBoard.mockResolvedValue(
    Array.from({ length: 50 }, (_, i) => row(`u${i}`, `P${i}`, 10 + i / 10))
  );
  renderModal();
  expect(
    await screen.findByText("5.1 s faster to reach the top 50!")
  ).toBeVisible();
});

it("shows nothing extra when the board cannot load", async () => {
  mockBoard.fetchBoard.mockResolvedValue(null);
  renderModal();
  await waitFor(() => expect(mockBoard.fetchBoard).toHaveBeenCalled());
  expect(screen.queryByTestId("finish-standing")).not.toBeInTheDocument();
  expect(screen.getByRole("dialog")).toBeVisible();
});

it("makes no calls when leaderboards are off", () => {
  render(
    <FlightRewardModal
      levelId="meadow"
      flight={flight}
      leaderboardsEnabled={false}
    />
  );
  expect(mockAuth.getIdToken).not.toHaveBeenCalled();
});

it("opens the board on the world's tab over the popup and restores focus", async () => {
  mockBoard.fetchBoard.mockResolvedValue([
    row("a", "Ace 1", 10),
    row("me", "Me Pilot 1", 20),
  ]);
  renderModal();
  const open = await screen.findByRole("button", { name: /see the board/i });
  await userEvent.click(open);

  const dialogs = screen.getAllByRole("dialog", { hidden: true });
  const boardDialog = dialogs.find((d) =>
    d.getAttribute("aria-labelledby")?.includes("leaderboards")
  )!;
  expect(
    within(boardDialog).getByRole("tab", { name: "Per world", selected: true })
  ).toBeVisible();
  expect(within(boardDialog).getByRole("combobox")).toHaveValue("meadow");
  expect(mockBoard.fetchBoard).toHaveBeenCalledWith({ world: "meadow" });
  expect(
    await within(boardDialog).findByText("Me Pilot 1", {
      selector: "span",
    })
  ).toBeVisible();

  // The popup underneath is inert and ignores keys while the board is open.
  const reward = document.getElementById("flight-reward-title")!;
  expect(reward.closest("[inert]")).not.toBeNull();

  await userEvent.keyboard("{Escape}");
  expect(screen.queryByText("🏆 Leaderboards")).not.toBeInTheDocument();
  await waitFor(() => expect(open).toHaveFocus());
});

it("keeps the standing out of the popup until the coin gauge is stopped", async () => {
  mockBoard.fetchBoard.mockResolvedValue([row("me", "Me Pilot 1", 20)]);
  render(
    <FlightRewardModal levelId="meadow" flight={{ ...flight, bonus: null }} />
  );
  await waitFor(() => expect(mockBoard.fetchBoard).toHaveBeenCalled());
  await screen.findByRole("button", { name: /stop/i });
  expect(screen.queryByTestId("finish-standing")).not.toBeInTheDocument();
});
