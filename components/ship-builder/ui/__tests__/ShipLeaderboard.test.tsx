import { act } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  recordBest,
  EMPTY_PROGRESS,
} from "@/lib/ship-builder/challenges/progress";
import { challengeProgress } from "@/lib/ship-builder/challenges/progressStore";
import {
  noteShipSeason,
  refreshShipSeason,
  resetShipSeasonForTests,
} from "../../hooks/shipBoardSync";
import ShipLeaderboard from "../ShipLeaderboard";

jest.mock("../../hooks/shipBoardSync", () => ({
  ...jest.requireActual("../../hooks/shipBoardSync"),
  refreshShipSeason: jest.fn(),
}));

jest.mock("@/lib/leaderboard/auth", () => ({
  getIdToken: jest.fn(),
}));
jest.mock("@/lib/leaderboard/shipBoard", () => ({
  fetchShipBoard: jest.fn(),
}));

import { getIdToken } from "@/lib/leaderboard/auth";
import { fetchShipBoard } from "@/lib/leaderboard/shipBoard";

const mockedToken = jest.mocked(getIdToken);
const mockedBoard = jest.mocked(fetchShipBoard);
const mockedRefresh = jest.mocked(refreshShipSeason);

function rows(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    uid: `u${i}`,
    nickname: `Happy Otter ${i + 1}`,
    value: 100 - i,
  }));
}

beforeEach(() => {
  localStorage.clear();
  mockedToken.mockReset();
  mockedBoard.mockReset();
  // By default the read on open finds the season already known.
  mockedRefresh.mockReset().mockImplementation(async () => 1);
  act(() => challengeProgress.resetMemory());
  act(() => resetShipSeasonForTests());
  act(() => noteShipSeason(1));
});

describe("ShipLeaderboard", () => {
  it("makes no request when disabled", () => {
    render(<ShipLeaderboard enabled={false} />);
    expect(screen.getByText(/switched off/)).toBeInTheDocument();
    expect(mockedToken).not.toHaveBeenCalled();
    expect(mockedRefresh).not.toHaveBeenCalled();
  });

  it("shows the top 20 and your own rank", async () => {
    act(() =>
      challengeProgress.set({
        ...recordBest(EMPTY_PROGRESS, "a", "outlast", 170),
        nickname: "Brave Fox 3",
      })
    );
    mockedToken.mockResolvedValue({ uid: "me", idToken: "t" });
    mockedBoard.mockResolvedValue([
      ...rows(30),
      { uid: "me", nickname: "Brave Fox 3", value: 2 },
    ]);
    render(<ShipLeaderboard enabled />);
    expect(await screen.findByText("Happy Otter 1")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(20);
    expect(screen.getByTestId("ship-board-standing")).toHaveTextContent(
      "You are #31 with 2 stars. Sailing as Brave Fox 3."
    );
  });

  it("renders nicknames as text, never markup", async () => {
    mockedToken.mockResolvedValue({ uid: "me", idToken: "t" });
    mockedBoard.mockResolvedValue([
      { uid: "x", nickname: "<b>bold</b>", value: 5 },
    ]);
    const { container } = render(<ShipLeaderboard enabled />);
    expect(await screen.findByText("<b>bold</b>")).toBeInTheDocument();
    expect(container.querySelector("b")).toBeNull();
  });

  it("invites you to earn a star first", async () => {
    mockedToken.mockResolvedValue({ uid: "me", idToken: "t" });
    mockedBoard.mockResolvedValue(rows(3));
    render(<ShipLeaderboard enabled />);
    expect(await screen.findByText(/Earn a star to join/)).toBeInTheDocument();
  });

  it("says so when the board cannot be reached", async () => {
    mockedToken.mockResolvedValue(null);
    render(<ShipLeaderboard enabled />);
    expect(await screen.findByText(/Couldn.t reach/)).toBeInTheDocument();
  });
});

describe("ShipLeaderboard seasons", () => {
  const me = { uid: "me", nickname: "Brave Fox 3", value: 2 };

  it("reads the season again when the board opens", async () => {
    mockedToken.mockResolvedValue({ uid: "me", idToken: "t" });
    mockedBoard.mockResolvedValue(rows(3));
    render(<ShipLeaderboard enabled />);
    expect(mockedRefresh).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Happy Otter 1")).toBeInTheDocument();
  });

  it("says it couldn't reach the board when the season read fails", async () => {
    act(() => resetShipSeasonForTests());
    mockedRefresh.mockResolvedValue(null);
    render(<ShipLeaderboard enabled />);
    expect(await screen.findByText(/Couldn.t reach/)).toBeInTheDocument();
    expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
    expect(mockedBoard).not.toHaveBeenCalled();
  });

  it("shows a newer season found when the board opens", async () => {
    mockedToken.mockResolvedValue({ uid: "me", idToken: "t" });
    mockedBoard.mockResolvedValue(rows(3));
    act(() => noteShipSeason(2));
    mockedRefresh.mockImplementation(async () => {
      noteShipSeason(3);
      return 3;
    });
    render(<ShipLeaderboard enabled />);
    const picker = await screen.findByRole("combobox", { name: "Season" });
    await waitFor(() => expect(picker).toHaveValue("3"));
    expect(within(picker).getAllByRole("option")[0]).toHaveTextContent(
      "Season 3 (now)"
    );
    await waitFor(() => expect(mockedBoard).toHaveBeenCalledWith(3));
  });

  it("waits for the season before reading the board", async () => {
    act(() => resetShipSeasonForTests());
    mockedRefresh.mockReturnValue(new Promise(() => {}));
    mockedToken.mockResolvedValue({ uid: "me", idToken: "t" });
    mockedBoard.mockResolvedValue(rows(3));
    render(<ShipLeaderboard enabled />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading the leaderboard…"
    );
    await act(async () => {});
    expect(mockedBoard).not.toHaveBeenCalled();
    expect(screen.queryByText(/Couldn.t reach/)).not.toBeInTheDocument();
    act(() => noteShipSeason(3));
    await waitFor(() => expect(mockedBoard).toHaveBeenCalledWith(3));
  });

  it("ranks this season's stars and fetches a past season when picked", async () => {
    // Stars on another design, all from before this season.
    act(() =>
      challengeProgress.set({
        ...recordBest(EMPTY_PROGRESS, "b", "outlast", 170),
        nickname: "Brave Fox 3",
      })
    );
    act(() => noteShipSeason(3));
    act(() =>
      challengeProgress.set(
        recordBest(challengeProgress.get(), "a", "outlast", 170)
      )
    );
    mockedToken.mockResolvedValue({ uid: "me", idToken: "t" });
    mockedBoard.mockResolvedValue([...rows(5), me]);
    render(<ShipLeaderboard enabled />);
    expect(await screen.findByText("Happy Otter 1")).toBeInTheDocument();
    expect(mockedBoard).toHaveBeenCalledWith(3);
    expect(screen.getByTestId("ship-board-standing")).toHaveTextContent(
      "You are #6 with 2 stars."
    );

    const picker = screen.getByRole("combobox", { name: "Season" });
    expect(
      within(picker)
        .getAllByRole("option")
        .map((o) => o.textContent)
    ).toEqual(["Season 3 (now)", "Season 2", "Season 1"]);
    await userEvent.selectOptions(picker, "2");
    await waitFor(() => expect(mockedBoard).toHaveBeenCalledWith(2));
    await waitFor(() =>
      expect(screen.getByText("Brave Fox 3").closest("li")).toHaveAttribute(
        "data-own",
        "true"
      )
    );
  });

  it("tells a returning player about the new season until dismissed", async () => {
    act(() =>
      challengeProgress.set({
        ...recordBest(EMPTY_PROGRESS, "a", "outlast", 170),
        nickname: "Brave Fox 3",
      })
    );
    act(() => noteShipSeason(2));
    mockedToken.mockResolvedValue({ uid: "me", idToken: "t" });
    mockedBoard.mockResolvedValue(rows(3));
    render(<ShipLeaderboard enabled />);
    const note = await screen.findByText(
      "New season! Everyone starts from zero. Earn stars to get on the board."
    );
    expect(note).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(screen.queryByText(/New season!/)).not.toBeInTheDocument();
  });
});
