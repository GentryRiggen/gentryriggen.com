import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as auth from "@/lib/leaderboard/auth";
import * as board from "@/lib/leaderboard/client";
import type { LeaderboardRow } from "@/lib/leaderboard/types";
import { newProgress } from "@/lib/plane-builder/economy/progress";
import { usePlaneBuilderStore } from "@/lib/plane-builder/state/store";
import LeaderboardCard, { LAST_RANK_KEY } from "../LeaderboardCard";

jest.mock("@/lib/leaderboard/auth");
jest.mock("@/lib/leaderboard/client");
jest.mock("@/lib/plane-builder/state/leaderboardSync", () => ({
  LEADERBOARDS_ENABLED: true,
  requestLeaderboardSubmit: jest.fn(),
}));

const mockAuth = jest.mocked(auth);
const mockBoard = jest.mocked(board);

const UNIT = 1e9;
const row = (uid: string, nickname: string, value: number): LeaderboardRow => ({
  uid,
  nickname,
  value,
});

/** The board ranks this season's stats, not the all-time ones. */
function setPlayer(prestiges: number, distance: number) {
  const base = newProgress();
  usePlaneBuilderStore.setState({
    currentSeason: 2,
    isBoardHidden: false,
    progress: {
      ...base,
      prestige: { ...base.prestige, level: prestiges + 5 },
      lifetimeDistance: distance + 9_000_000,
      season: { ...base.season, number: 2, prestiges, distance },
      nickname: "Speedy Falcon 42",
    },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  setPlayer(1, 500);
  mockAuth.getIdToken.mockResolvedValue({ uid: "me", idToken: "t" });
  mockBoard.fetchBoard.mockResolvedValue([]);
});

it("shows nothing and fetches nothing while the board is hidden", async () => {
  usePlaneBuilderStore.setState({ isBoardHidden: true });
  const { container } = render(<LeaderboardCard enabled />);
  await Promise.resolve();
  expect(container).toBeEmptyDOMElement();
  expect(mockAuth.getIdToken).not.toHaveBeenCalled();
  expect(mockBoard.fetchBoard).not.toHaveBeenCalled();
});

it("reads the current season's board", async () => {
  render(<LeaderboardCard enabled />);
  await waitFor(() =>
    expect(mockBoard.fetchBoard).toHaveBeenCalledWith("prestige", 2)
  );
});

it("still offers the board before the season is read", async () => {
  usePlaneBuilderStore.setState({ currentSeason: null });
  render(<LeaderboardCard enabled />);
  expect(await screen.findByText("See who's flying 🏆")).toBeVisible();
  expect(mockBoard.fetchBoard).not.toHaveBeenCalled();
});

it("shows rank and the rival to pass", async () => {
  mockBoard.fetchBoard.mockResolvedValue([
    row("a", "Top Cat", 3 * UNIT),
    row("b", "Quick Hen", 2 * UNIT),
    row("c", "Calm Owl", UNIT + 900),
    row("d", "Breezy Otter 7", UNIT + 340_500),
    row("me", "Speedy Falcon 42", UNIT + 500),
  ]);
  // Not all rivals are ahead: put Breezy directly above the player.
  mockBoard.fetchBoard.mockResolvedValue([
    row("a", "Top Cat", 3 * UNIT),
    row("b", "Quick Hen", 2 * UNIT),
    row("c", "Calm Owl", UNIT + 900_000),
    row("d", "Breezy Otter 7", UNIT + 340_500),
    row("me", "Speedy Falcon 42", UNIT + 500),
  ]);
  render(<LeaderboardCard enabled />);
  expect(await screen.findByText("🏆 You're #5 in the world!")).toBeVisible();
  expect(screen.getByText("340 km to pass Breezy Otter 7")).toBeVisible();
  expect(screen.getByText("Flying as Speedy Falcon 42")).toBeVisible();
});

it("gives a medal to the top three", async () => {
  mockBoard.fetchBoard.mockResolvedValue([
    row("a", "Top Cat", 3 * UNIT),
    row("b", "Quick Hen", 2 * UNIT),
    row("me", "Speedy Falcon 42", UNIT + 500),
  ]);
  render(<LeaderboardCard enabled />);
  expect(await screen.findByText("🥉 You're #3 in the world!")).toBeVisible();
  expect(screen.getByText("Prestige to catch Quick Hen")).toBeVisible();
});

it("celebrates being first", async () => {
  mockBoard.fetchBoard.mockResolvedValue([
    row("me", "Speedy Falcon 42", UNIT + 500),
    row("a", "Top Cat", UNIT),
  ]);
  render(<LeaderboardCard enabled />);
  expect(
    await screen.findByText("🥇 You're the top pilot in the world! 👑")
  ).toBeVisible();
});

it("uses the live local value, not the uploaded one", async () => {
  setPlayer(1, 5_000);
  mockBoard.fetchBoard.mockResolvedValue([
    row("a", "Top Cat", UNIT + 3_000),
    row("me", "Speedy Falcon 42", UNIT + 500),
  ]);
  render(<LeaderboardCard enabled />);
  expect(await screen.findByText(/#1 in the world|top pilot/)).toBeVisible();
});

it("says how far to the top 50 when off the board", async () => {
  const rows = Array.from({ length: 50 }, (_, i) =>
    row(`u${i}`, `Pilot ${i}`, UNIT + 2_600 + (50 - i) * 10)
  );
  mockBoard.fetchBoard.mockResolvedValue(rows);
  render(<LeaderboardCard enabled />);
  expect(await screen.findByText(/Fly 2\.\d km more to reach the top 50!/));
});

it("asks for a prestige when the cutoff is a level higher", async () => {
  const rows = Array.from({ length: 50 }, (_, i) =>
    row(`u${i}`, `Pilot ${i}`, 2 * UNIT + i)
  );
  mockBoard.fetchBoard.mockResolvedValue(rows);
  render(<LeaderboardCard enabled />);
  expect(
    await screen.findByText("Prestige to reach the top 50!")
  ).toBeVisible();
});

it("shows a friendly line while loading and when the board fails", async () => {
  mockBoard.fetchBoard.mockResolvedValue(null);
  render(<LeaderboardCard enabled />);
  expect(await screen.findByText("See who's flying 🏆")).toBeVisible();
});

it("is hidden when disabled or signed out", async () => {
  const { unmount } = render(<LeaderboardCard enabled={false} />);
  expect(mockAuth.getIdToken).not.toHaveBeenCalled();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  unmount();

  mockAuth.getIdToken.mockResolvedValue(null);
  render(<LeaderboardCard enabled />);
  await waitFor(() => expect(mockAuth.getIdToken).toHaveBeenCalled());
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

it("shows an up pill when the rank improved, then remembers it", async () => {
  window.localStorage.setItem(LAST_RANK_KEY, "5");
  mockBoard.fetchBoard.mockResolvedValue([
    row("a", "Top Cat", 3 * UNIT),
    row("b", "Quick Hen", 2 * UNIT),
    row("me", "Speedy Falcon 42", UNIT + 500),
  ]);
  render(<LeaderboardCard enabled />);
  expect(await screen.findByText("▲ up 2!")).toBeVisible();
  expect(window.localStorage.getItem(LAST_RANK_KEY)).toBe("3");
});

it("shows no pill when the rank did not improve", async () => {
  window.localStorage.setItem(LAST_RANK_KEY, "2");
  mockBoard.fetchBoard.mockResolvedValue([
    row("a", "Top Cat", 3 * UNIT),
    row("b", "Quick Hen", 2 * UNIT),
    row("me", "Speedy Falcon 42", UNIT + 500),
  ]);
  render(<LeaderboardCard enabled />);
  await screen.findByText(/#3 in the world/);
  expect(screen.queryByText(/▲/)).not.toBeInTheDocument();
  expect(window.localStorage.getItem(LAST_RANK_KEY)).toBe("3");
});

it("opens the leaderboards when tapped", async () => {
  render(<LeaderboardCard enabled />);
  await userEvent.click(await screen.findByRole("button"));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
});

it("shows the card with the friendly line while the board is loading", async () => {
  mockBoard.fetchBoard.mockReturnValue(new Promise(() => {}));
  render(<LeaderboardCard enabled />);
  expect(await screen.findByText("See who's flying 🏆")).toBeVisible();
});

it("shows metres when the gap is under a kilometre", async () => {
  mockBoard.fetchBoard.mockResolvedValue([
    row("a", "Top Cat", 3 * UNIT),
    row("b", "Quick Hen", UNIT + 540),
    row("me", "Speedy Falcon 42", UNIT + 500),
  ]);
  render(<LeaderboardCard enabled />);
  expect(await screen.findByText("40 m to pass Quick Hen")).toBeVisible();
});
