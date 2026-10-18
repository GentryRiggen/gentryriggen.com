import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as auth from "@/lib/leaderboard/auth";
import * as board from "@/lib/leaderboard/client";
import { isValidNickname } from "@/lib/leaderboard/nickname";
import { newProgress } from "@/lib/plane-builder/economy/progress";
import { usePlaneBuilderStore } from "@/lib/plane-builder/state/store";
import LeaderboardCard from "../LeaderboardCard";

jest.mock("@/lib/leaderboard/auth");
jest.mock("@/lib/leaderboard/client");
jest.mock("@/lib/plane-builder/state/leaderboardSync", () => ({
  LEADERBOARDS_ENABLED: true,
  requestLeaderboardSubmit: jest.fn(),
}));

const mockAuth = jest.mocked(auth);
const mockBoard = jest.mocked(board);

beforeEach(() => {
  jest.clearAllMocks();
  usePlaneBuilderStore.setState({
    progress: { ...newProgress(), nickname: "Speedy Falcon 42" },
  });
  mockAuth.getIdToken.mockResolvedValue({ uid: "me", idToken: "t" });
  mockBoard.fetchBoard.mockResolvedValue([
    { uid: "x", nickname: "<i>Zed</i>", value: 2 * 1e9 + 12_300 },
    { uid: "me", nickname: "Speedy Falcon 42", value: 1e9 + 500 },
  ]);
});

async function openBoards() {
  render(<LeaderboardCard enabled />);
  await userEvent.click(await screen.findByRole("button"));
  return screen.getByRole("dialog");
}

it("is hidden when there is no token", async () => {
  mockAuth.getIdToken.mockResolvedValue(null);
  render(<LeaderboardCard enabled />);
  await waitFor(() => expect(mockAuth.getIdToken).toHaveBeenCalled());
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

it("makes no call when disabled", () => {
  render(<LeaderboardCard enabled={false} />);
  expect(mockAuth.getIdToken).not.toHaveBeenCalled();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

it("shows prestige rows as text and highlights your own", async () => {
  const dialog = await openBoards();
  expect(mockBoard.fetchBoard).toHaveBeenCalledWith("prestige");
  expect(await within(dialog).findByText("<i>Zed</i>")).toBeInTheDocument();
  expect(dialog.querySelector("i")).toBeNull();
  expect(within(dialog).getByText("⭐ 2 · 12.3 km")).toBeInTheDocument();
  const own = dialog.querySelector("[data-own='true']");
  expect(own).toHaveTextContent("Speedy Falcon 42");
  expect(own).toHaveTextContent("⭐ 1 · 0.5 km");
});

it("fetches the fastest run and per-world boards", async () => {
  const dialog = await openBoards();
  mockBoard.fetchBoard.mockResolvedValue([
    { uid: "x", nickname: "A", value: 12 },
  ]);
  await userEvent.click(
    within(dialog).getByRole("tab", { name: "Fastest run" })
  );
  expect(mockBoard.fetchBoard).toHaveBeenCalledWith("fastestRun");
  expect(await within(dialog).findByText("12 flights")).toBeInTheDocument();

  mockBoard.fetchBoard.mockResolvedValue([
    { uid: "x", nickname: "A", value: 12.44 },
  ]);
  await userEvent.click(within(dialog).getByRole("tab", { name: "Per world" }));
  expect(mockBoard.fetchBoard).toHaveBeenCalledWith({ world: "meadow" });
  expect(await within(dialog).findByText("12.4 s")).toBeInTheDocument();

  await userEvent.selectOptions(within(dialog).getByRole("combobox"), "canyon");
  expect(mockBoard.fetchBoard).toHaveBeenCalledWith({ world: "canyon" });
});

it("shows empty and error states", async () => {
  mockBoard.fetchBoard.mockResolvedValue([]);
  const dialog = await openBoards();
  expect(await within(dialog).findByText(/be the first/i)).toBeInTheDocument();
  mockBoard.fetchBoard.mockResolvedValue(null);
  await userEvent.click(
    within(dialog).getByRole("tab", { name: "Fastest run" })
  );
  expect(await within(dialog).findByRole("alert")).toBeInTheDocument();
});

it("rerolls to a valid new nickname and closes on Escape", async () => {
  const dialog = await openBoards();
  expect(within(dialog).getByTestId("my-nickname")).toHaveTextContent(
    "Speedy Falcon 42"
  );
  await userEvent.click(
    within(dialog).getByRole("button", { name: /new name/i })
  );
  const name = usePlaneBuilderStore.getState().progress.nickname;
  expect(isValidNickname(name)).toBe(true);
  await userEvent.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
