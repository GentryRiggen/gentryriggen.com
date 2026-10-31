import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SeasonBoardAdmin from "../SeasonBoardAdmin";
import * as client from "@/lib/firebase/client";
import { isValidNickname } from "@/lib/leaderboard/nickname";

jest.mock("@/lib/firebase/client");
const mockClient = jest.mocked(client);

const planeRows: client.AdminBoardRow[] = [
  {
    uid: "a",
    nickname: "<img src=x>",
    prestige: 2,
    lifetimeDistance: 12_300,
    updatedAt: new Date("2026-10-01T00:00:00Z"),
  },
  {
    uid: "b",
    nickname: "Happy Fox 3",
    prestige: 1,
    lifetimeDistance: 0,
    updatedAt: null,
  },
];

const shipRows: client.AdminBoardRow[] = [
  { uid: "s", nickname: "Calm Seal 4", totalStars: 17, updatedAt: null },
];

let confirm: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  confirm = jest.spyOn(window, "confirm").mockReturnValue(true);
  mockClient.fetchAdminSeason.mockResolvedValue({
    number: 3,
    startedAt: new Date("2026-10-20T12:00:00Z"),
  });
  mockClient.fetchAdminBoard.mockImplementation(async (game) =>
    game === "plane" ? planeRows : shipRows
  );
  mockClient.fetchAdminBoardHidden.mockResolvedValue(true);
  mockClient.startNewSeason.mockResolvedValue(4);
  mockClient.deleteBoardEntry.mockResolvedValue();
  mockClient.banAndDeleteEverywhere.mockResolvedValue();
  mockClient.renameBoardEntry.mockResolvedValue();
  mockClient.setBoardHidden.mockResolvedValue();
});

afterEach(() => {
  confirm.mockRestore();
});

const rowFor = (name: string) =>
  screen.getByText(name).closest("li") as HTMLElement;

it("shows the heading, season and start date", async () => {
  render(<SeasonBoardAdmin game="plane" />);
  expect(
    screen.getByRole("heading", { name: "Plane Builder leaderboard" })
  ).toBeInTheDocument();
  const date = new Date("2026-10-20T12:00:00Z").toLocaleDateString();
  expect(
    await screen.findByText(`Season 3, started ${date}`)
  ).toBeInTheDocument();
  expect(mockClient.fetchAdminBoard).toHaveBeenCalledWith("plane", 3);
  expect(await screen.findByText("Happy Fox 3")).toBeInTheDocument();
  expect(screen.getByText("12.3 km")).toBeInTheDocument();
});

it("shows Season 1 with no date before any season is started", async () => {
  mockClient.fetchAdminSeason.mockResolvedValue({
    number: 1,
    startedAt: null,
  });
  render(<SeasonBoardAdmin game="ship" />);
  expect(
    screen.getByRole("heading", { name: "Ship Builder leaderboard" })
  ).toBeInTheDocument();
  expect(
    await screen.findByText("Season 1", { selector: "p" })
  ).toBeInTheDocument();
  expect(await screen.findByText("17 stars")).toBeInTheDocument();
  expect(mockClient.fetchAdminBoard).toHaveBeenCalledWith("ship", 1);
});

it("renders a nickname with markup as literal text", async () => {
  const { container } = render(<SeasonBoardAdmin game="plane" />);
  expect(await screen.findByText("<img src=x>")).toBeInTheDocument();
  expect(container.querySelector("img")).toBeNull();
});

it("starts a new season after confirming and loads it", async () => {
  render(<SeasonBoardAdmin game="plane" />);
  await screen.findByText("Happy Fox 3");
  mockClient.fetchAdminSeason.mockResolvedValue({
    number: 4,
    startedAt: new Date("2026-10-30T12:00:00Z"),
  });
  await userEvent.click(
    screen.getByRole("button", { name: "Start new season" })
  );
  expect(confirm).toHaveBeenCalledWith(
    "Start Season 4 for Plane Builder? Everyone starts from zero. Season 3 stays viewable."
  );
  expect(mockClient.startNewSeason).toHaveBeenCalledWith("plane");
  await waitFor(() =>
    expect(mockClient.fetchAdminBoard).toHaveBeenLastCalledWith("plane", 4)
  );
  expect(await screen.findByText(/^Season 4, started/)).toBeInTheDocument();
});

it("does nothing when starting a season is cancelled", async () => {
  confirm.mockReturnValue(false);
  render(<SeasonBoardAdmin game="plane" />);
  await screen.findByText("Happy Fox 3");
  await userEvent.click(
    screen.getByRole("button", { name: "Start new season" })
  );
  expect(mockClient.startNewSeason).not.toHaveBeenCalled();
});

it("switches the season shown with the picker", async () => {
  render(<SeasonBoardAdmin game="plane" />);
  await screen.findByText("Happy Fox 3");
  const picker = screen.getByRole("combobox", { name: "Season" });
  expect(
    within(picker)
      .getAllByRole("option")
      .map((o) => o.textContent)
  ).toEqual(["Season 3", "Season 2", "Season 1"]);
  await userEvent.selectOptions(picker, "1");
  await waitFor(() =>
    expect(mockClient.fetchAdminBoard).toHaveBeenLastCalledWith("plane", 1)
  );
});

it("deletes an entry from the shown season after confirming", async () => {
  render(<SeasonBoardAdmin game="plane" />);
  await screen.findByText("Happy Fox 3");
  await userEvent.click(
    within(rowFor("Happy Fox 3")).getByRole("button", { name: "Delete" })
  );
  expect(confirm).toHaveBeenCalledWith(
    "Remove Happy Fox 3 from Season 3? They'll climb back as they keep playing."
  );
  expect(mockClient.deleteBoardEntry).toHaveBeenCalledWith("plane", 3, "b");
  await waitFor(() =>
    expect(screen.queryByText("Happy Fox 3")).not.toBeInTheDocument()
  );
});

it("does not delete when cancelled", async () => {
  confirm.mockReturnValue(false);
  render(<SeasonBoardAdmin game="plane" />);
  await screen.findByText("Happy Fox 3");
  await userEvent.click(
    within(rowFor("Happy Fox 3")).getByRole("button", { name: "Delete" })
  );
  expect(mockClient.deleteBoardEntry).not.toHaveBeenCalled();
  expect(screen.getByText("Happy Fox 3")).toBeInTheDocument();
});

it("bans and deletes everywhere after confirming", async () => {
  render(<SeasonBoardAdmin game="plane" />);
  await screen.findByText("Happy Fox 3");
  await userEvent.click(
    within(rowFor("Happy Fox 3")).getByRole("button", {
      name: "Delete and ban",
    })
  );
  expect(confirm).toHaveBeenCalledWith(
    "Ban Happy Fox 3? They'll be removed from every board in both games and can't post again."
  );
  expect(mockClient.banAndDeleteEverywhere).toHaveBeenCalledWith("b");
  await waitFor(() =>
    expect(screen.queryByText("Happy Fox 3")).not.toBeInTheDocument()
  );
});

it("gives an entry a new generated name after confirming", async () => {
  render(<SeasonBoardAdmin game="plane" />);
  await screen.findByText("Happy Fox 3");
  await userEvent.click(
    within(rowFor("Happy Fox 3")).getByRole("button", { name: "New name" })
  );
  expect(confirm).toHaveBeenCalledWith("Give Happy Fox 3 a new random name?");
  expect(mockClient.renameBoardEntry).toHaveBeenCalledTimes(1);
  const [game, season, uid, name] = mockClient.renameBoardEntry.mock.calls[0];
  expect([game, season, uid]).toEqual(["plane", 3, "b"]);
  expect(isValidNickname(name)).toBe(true);
  expect(await screen.findByText(name)).toBeInTheDocument();
});

it("shows an error when a write is refused", async () => {
  mockClient.deleteBoardEntry.mockRejectedValue(new Error("denied"));
  render(<SeasonBoardAdmin game="plane" />);
  await screen.findByText("Happy Fox 3");
  await userEvent.click(
    within(rowFor("Happy Fox 3")).getByRole("button", { name: "Delete" })
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Couldn't save that change."
  );
  expect(screen.getByText("Happy Fox 3")).toBeInTheDocument();
});

it("shows an error when loading fails", async () => {
  mockClient.fetchAdminBoard.mockRejectedValue(new Error("nope"));
  render(<SeasonBoardAdmin game="plane" />);
  expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't load/i);
});

describe("show leaderboard to players (plane only)", () => {
  it("reflects the hidden setting and saves changes", async () => {
    render(<SeasonBoardAdmin game="plane" />);
    const box = await screen.findByRole("checkbox", {
      name: "Show leaderboard to players",
    });
    await waitFor(() => expect(box).toBeEnabled());
    expect(box).not.toBeChecked();
    await userEvent.click(box);
    expect(mockClient.setBoardHidden).toHaveBeenCalledWith("plane", false);
    expect(box).toBeChecked();
    await userEvent.click(box);
    expect(mockClient.setBoardHidden).toHaveBeenLastCalledWith("plane", true);
    expect(box).not.toBeChecked();
  });

  it("is checked when the board is shown", async () => {
    mockClient.fetchAdminBoardHidden.mockResolvedValue(false);
    render(<SeasonBoardAdmin game="plane" />);
    const box = await screen.findByRole("checkbox", {
      name: "Show leaderboard to players",
    });
    await waitFor(() => expect(box).toBeChecked());
  });

  it("reverts and shows an error when saving fails", async () => {
    mockClient.setBoardHidden.mockRejectedValue(new Error("denied"));
    render(<SeasonBoardAdmin game="plane" />);
    const box = await screen.findByRole("checkbox", {
      name: "Show leaderboard to players",
    });
    await waitFor(() => expect(box).toBeEnabled());
    await userEvent.click(box);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't save that change."
    );
    expect(box).not.toBeChecked();
  });

  it("is not shown on the ship board", async () => {
    render(<SeasonBoardAdmin game="ship" />);
    await screen.findByText("Calm Seal 4");
    expect(
      screen.queryByRole("checkbox", { name: "Show leaderboard to players" })
    ).not.toBeInTheDocument();
    expect(mockClient.fetchAdminBoardHidden).not.toHaveBeenCalled();
  });
});
