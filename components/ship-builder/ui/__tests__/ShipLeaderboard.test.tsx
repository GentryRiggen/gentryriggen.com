import { act } from "react";
import { render, screen } from "@testing-library/react";
import {
  recordBest,
  EMPTY_PROGRESS,
} from "@/lib/ship-builder/challenges/progress";
import { challengeProgress } from "../../hooks/challengeProgress";
import ShipLeaderboard from "../ShipLeaderboard";

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
  act(() => challengeProgress.resetMemory());
});

describe("ShipLeaderboard", () => {
  it("makes no request when disabled", () => {
    render(<ShipLeaderboard enabled={false} />);
    expect(screen.getByText(/switched off/)).toBeInTheDocument();
    expect(mockedToken).not.toHaveBeenCalled();
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
