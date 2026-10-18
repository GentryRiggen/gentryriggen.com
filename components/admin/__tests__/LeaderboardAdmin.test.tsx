import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LeaderboardAdmin from "../LeaderboardAdmin";
import * as client from "@/lib/firebase/client";

jest.mock("@/lib/firebase/client");
const mockClient = jest.mocked(client);

const rows = [
  {
    uid: "a",
    nickname: "<b>Evil</b>",
    prestige: 2,
    score: 2_000_000_500,
    lifetimeDistance: 12_300,
    updatedAt: new Date("2026-10-01T00:00:00Z"),
  },
  {
    uid: "b",
    nickname: "Happy Fox 3",
    prestige: 1,
    score: 1_000_000_000,
    lifetimeDistance: 0,
    updatedAt: null,
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockClient.fetchLeaderboardTop.mockResolvedValue(rows);
  mockClient.deleteLeaderboardEntry.mockResolvedValue();
});

it("lists entries as plain text", async () => {
  const { container } = render(<LeaderboardAdmin />);
  expect(await screen.findByText("<b>Evil</b>")).toBeInTheDocument();
  expect(container.querySelector("b")).toBeNull();
  expect(screen.getByText("12.3 km")).toBeInTheDocument();
});

it("deletes only after confirming", async () => {
  const confirm = jest.spyOn(window, "confirm");
  render(<LeaderboardAdmin />);
  const buttons = await screen.findAllByRole("button", { name: "Delete" });

  confirm.mockReturnValueOnce(false);
  await userEvent.click(buttons[0]);
  expect(mockClient.deleteLeaderboardEntry).not.toHaveBeenCalled();

  confirm.mockReturnValueOnce(true);
  await userEvent.click(buttons[0]);
  expect(mockClient.deleteLeaderboardEntry).toHaveBeenCalledWith("a");
  await waitFor(() =>
    expect(screen.queryByText("<b>Evil</b>")).not.toBeInTheDocument()
  );
  confirm.mockRestore();
});

it("shows an error when loading fails", async () => {
  mockClient.fetchLeaderboardTop.mockRejectedValue(new Error("nope"));
  render(<LeaderboardAdmin />);
  expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't load/i);
});
