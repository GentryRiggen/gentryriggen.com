import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as api from "@/lib/jim/reminders";
import NotesReminder from "../NotesReminder";
import NotesReminders from "../NotesReminders";
import RemindersCard from "../RemindersCard";

jest.mock("@/lib/jim/reminders");
const m = jest.mocked(api);
const getToken = jest.fn().mockResolvedValue("t");

function rem(
  id: string,
  text: string,
  when: string,
  sent: string | null = null
) {
  return {
    id,
    at: "2026-11-01T15:30:00-07:00",
    text,
    created: "2026-11-01T10:00:00-07:00",
    sent,
    rev: 0,
    when,
  };
}

const REAL_TZ = process.env.TZ;
beforeEach(() => jest.resetAllMocks());
afterEach(() => {
  jest.restoreAllMocks();
  if (REAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = REAL_TZ;
});

describe("NotesReminders", () => {
  const props = {
    api: "https://x",
    getToken,
    onBack: jest.fn(),
    onOpen: jest.fn(),
  };

  it("groups sent reminders as Due above the upcoming ones", async () => {
    m.listReminders.mockResolvedValue([
      rem("aaaaaaaaaaaa", "Water the ferns", "Today 3:30 PM", "x"),
      rem("bbbbbbbbbbbb", "Call the plumber", "Tomorrow 9:00 AM"),
    ]);
    render(<NotesReminders {...props} />);
    const due = await screen.findByRole("region", { name: "Due" });
    expect(within(due).getByText("Water the ferns")).toBeInTheDocument();
    const up = screen.getByRole("region", { name: "Upcoming" });
    expect(within(up).getByText("Call the plumber")).toBeInTheDocument();
    expect(within(up).getByText("Tomorrow 9:00 AM")).toBeInTheDocument();
  });

  it("opens a reminder", async () => {
    m.listReminders.mockResolvedValue([
      rem("bbbbbbbbbbbb", "Call the plumber", "Tomorrow 9:00 AM"),
    ]);
    render(<NotesReminders {...props} />);
    await userEvent.click(await screen.findByText("Call the plumber"));
    expect(props.onOpen).toHaveBeenCalledWith("bbbbbbbbbbbb");
  });

  it("shows the server's words when a time has passed", async () => {
    m.listReminders.mockResolvedValue([]);
    m.addReminder.mockRejectedValue(new Error("That time has passed."));
    render(<NotesReminders {...props} />);
    await userEvent.type(screen.getByLabelText("What"), "Stretch");
    await userEvent.click(screen.getByRole("button", { name: "Add reminder" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That time has passed."
    );
  });

  it("sends the device's offset, not the server's zone or Z", async () => {
    jest.spyOn(Date.prototype, "getTimezoneOffset").mockReturnValue(-330);
    m.listReminders.mockResolvedValue([]);
    m.addReminder.mockResolvedValue(rem("cccccccccccc", "Stretch", "x"));
    render(<NotesReminders {...props} />);
    await userEvent.type(screen.getByLabelText("What"), "Stretch");
    await userEvent.click(screen.getByRole("button", { name: "Add reminder" }));
    await waitFor(() => expect(m.addReminder).toHaveBeenCalled());
    expect(m.addReminder.mock.calls[0][0]).toMatch(/:00\+05:30$/);
  });

  it("adds a reminder to the list", async () => {
    m.listReminders.mockResolvedValue([]);
    m.addReminder.mockResolvedValue(
      rem("cccccccccccc", "Stretch", "Today 5 PM")
    );
    render(<NotesReminders {...props} />);
    await userEvent.type(screen.getByLabelText("What"), "Stretch");
    await userEvent.click(screen.getByRole("button", { name: "Add reminder" }));
    expect(await screen.findByText("Today 5 PM")).toBeInTheDocument();
    expect(m.addReminder).toHaveBeenCalledWith(
      expect.stringMatching(
        /^\d{4}-\d\d-\d\dT\d\d:(00|15|30|45):00[+-]\d\d:\d\d$/
      ),
      "Stretch",
      getToken,
      undefined,
      "https://x"
    );
  });
});

describe("NotesReminder", () => {
  const props = {
    id: "aaaaaaaaaaaa",
    api: "https://x",
    getToken,
    onBack: jest.fn(),
    onDone: jest.fn(),
    onList: jest.fn(),
  };

  it("snoozes an hour and shows the new time", async () => {
    m.getReminder.mockResolvedValue(
      rem("aaaaaaaaaaaa", "Water", "Today 3:30 PM")
    );
    m.patchReminder.mockResolvedValue(
      rem("aaaaaaaaaaaa", "Water", "Today 4:45 PM")
    );
    render(<NotesReminder {...props} />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Snooze 1 hour" })
    );
    expect(m.patchReminder).toHaveBeenCalledWith(
      "aaaaaaaaaaaa",
      { snooze: "1h" },
      getToken,
      undefined,
      "https://x"
    );
    expect(await screen.findByText("Today 4:45 PM")).toBeInTheDocument();
  });

  it("finishes with Done", async () => {
    m.getReminder.mockResolvedValue(
      rem("aaaaaaaaaaaa", "Water", "Today 3:30 PM")
    );
    m.doneReminder.mockResolvedValue();
    render(<NotesReminder {...props} />);
    await userEvent.click(await screen.findByRole("button", { name: "Done" }));
    await waitFor(() => expect(props.onDone).toHaveBeenCalled());
    expect(m.doneReminder).toHaveBeenCalledWith(
      "aaaaaaaaaaaa",
      getToken,
      undefined,
      "https://x"
    );
  });

  it("edits the time", async () => {
    process.env.TZ = "America/Denver";
    m.getReminder.mockResolvedValue(
      rem("aaaaaaaaaaaa", "Water", "Today 3:30 PM")
    );
    m.patchReminder.mockResolvedValue(
      rem("aaaaaaaaaaaa", "Water", "Today 6 PM")
    );
    render(<NotesReminder {...props} />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Edit time" })
    );
    expect(screen.getByLabelText("New time")).toHaveValue("2026-11-01T15:30");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(m.patchReminder).toHaveBeenCalledWith(
      "aaaaaaaaaaaa",
      { at: "2026-11-01T15:30:00-07:00" },
      getToken,
      undefined,
      "https://x"
    );
  });

  it("says so when the reminder is gone", async () => {
    m.getReminder.mockResolvedValue(null);
    render(<NotesReminder {...props} />);
    expect(
      await screen.findByText("This reminder is done or gone.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "All reminders" })
    ).toBeInTheDocument();
  });
});

describe("RemindersCard", () => {
  const props = { api: "https://x", getToken, onOpen: jest.fn() };

  it("shows the first three, fired ones included", async () => {
    m.listReminders.mockResolvedValue([
      rem("aaaaaaaaaaaa", "One", "Today 1 PM", "x"),
      rem("bbbbbbbbbbbb", "Two", "Today 2 PM"),
      rem("cccccccccccc", "Three", "Today 3 PM"),
      rem("dddddddddddd", "Four", "Today 4 PM"),
      rem("eeeeeeeeeeee", "Five", "Today 5 PM"),
    ]);
    render(<RemindersCard {...props} />);
    expect(await screen.findByText("Two")).toBeInTheDocument();
    expect(screen.getByText("One")).toBeInTheDocument();
    expect(screen.getByText("Three")).toBeInTheDocument();
    expect(screen.queryByText("Four")).toBeNull();
    expect(screen.queryByText("Five")).toBeNull();
    expect(
      screen.getByRole("button", { name: "All reminders" })
    ).toBeInTheDocument();
  });

  it("is hidden with none, and on an error", async () => {
    m.listReminders.mockResolvedValue([]);
    const { container, rerender } = render(<RemindersCard {...props} />);
    await waitFor(() => expect(m.listReminders).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
    m.listReminders.mockRejectedValue(new Error("x"));
    rerender(<RemindersCard {...props} getToken={jest.fn()} />);
    await waitFor(() => expect(m.listReminders).toHaveBeenCalledTimes(2));
    expect(container).toBeEmptyDOMElement();
  });
});
