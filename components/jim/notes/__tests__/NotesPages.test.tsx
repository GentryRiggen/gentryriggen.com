import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VIEW_FIXTURE } from "@/lib/jim/__tests__/fixtures";
import { normalizeView, type ViewData } from "@/lib/jim/view";
import NotesGolf from "../NotesGolf";
import NotesHealth from "../NotesHealth";
import NotesHome from "../NotesHome";
import NotesPeople from "../NotesPeople";
import NotesPerson from "../NotesPerson";
import NotesTraining from "../NotesTraining";

const EMPTY = normalizeView({ today: "2026-10-31" }) as ViewData;

describe("NotesHome", () => {
  it("shows the calendar for today and the next 7 days, with an as-of line", () => {
    render(<NotesHome data={VIEW_FIXTURE} onDone={jest.fn()} />);
    const cal = screen.getByRole("region", { name: "Calendar" });
    expect(within(cal).getByText("Team standup")).toBeInTheDocument();
    expect(within(cal).getByText("Harvest festival")).toBeInTheDocument();
    expect(within(cal).getByText("Planning review")).toBeInTheDocument();
    expect(within(cal).queryByText("Too far out")).not.toBeInTheDocument();
    expect(within(cal).queryByText("Already past")).not.toBeInTheDocument();
    expect(within(cal).getByText(/^Calendar as of Oct 31/)).toBeInTheDocument();
    expect(within(cal).getByText("Today")).toBeInTheDocument();
  });

  it("says calmly when there is no calendar snapshot yet", () => {
    render(
      <NotesHome
        data={{ ...VIEW_FIXTURE, calendar: null }}
        onDone={jest.fn()}
      />
    );
    expect(screen.getByText("No calendar snapshot yet.")).toBeInTheDocument();
    // The todos still show.
    expect(screen.getByText("Water the plants")).toBeInTheDocument();
  });

  it("shows an old snapshot's date and an empty week calmly", () => {
    render(
      <NotesHome
        data={{
          ...VIEW_FIXTURE,
          calendar: { fetchedAt: "2026-09-02T15:00:00Z", events: [] },
        }}
        onDone={jest.fn()}
      />
    );
    expect(screen.getByText(/^Calendar as of Sep 2/)).toBeInTheDocument();
    expect(
      screen.getByText("Nothing on the calendar this week.")
    ).toBeInTheDocument();
  });

  it("groups todos overdue, today, next 7 days and later, in order", () => {
    render(<NotesHome data={VIEW_FIXTURE} onDone={jest.fn()} />);
    const todos = screen.getByRole("region", { name: "Todos" });
    const headings = within(todos)
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);
    expect(headings).toEqual(["Overdue", "Today", "Next 7 days"]);
    const items = within(todos)
      .getAllByRole("listitem")
      .map((li) => li.querySelector("[data-title]")?.textContent);
    expect(items.slice(0, 5)).toEqual([
      "File the expense report",
      "Send the quarterly report",
      "Water the plants",
      "Renew the car registration",
      "Draft the onboarding plan",
    ]);
    expect(within(todos).getByText("11d late")).toBeInTheDocument();
    expect(within(todos).getByText("in 2d")).toBeInTheDocument();
    expect(within(todos).getByText("repeats")).toBeInTheDocument();
    expect(within(todos).getAllByText("Work").length).toBeGreaterThan(0);
  });

  it("keeps Later collapsed until opened", async () => {
    render(<NotesHome data={VIEW_FIXTURE} onDone={jest.fn()} />);
    const later = screen.getByText(/^Later/).closest("details");
    expect(later).not.toHaveAttribute("open");
    await userEvent.click(screen.getByText(/^Later/));
    expect(later).toHaveAttribute("open");
    expect(screen.getByText("Book the dentist")).toBeVisible();
  });

  it("hands Done: <title> to the chat", async () => {
    const onDone = jest.fn();
    render(<NotesHome data={VIEW_FIXTURE} onDone={onDone} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Done: Water the plants" })
    );
    expect(onDone).toHaveBeenCalledWith("Water the plants");
  });

  it("says so when there are no open todos", () => {
    render(<NotesHome data={EMPTY} onDone={jest.fn()} />);
    expect(screen.getByText("No open todos.")).toBeInTheDocument();
  });
});

describe("NotesHealth", () => {
  it("shows the last injection, the next draw, the hold and lab cards", () => {
    render(<NotesHealth data={VIEW_FIXTURE} />);
    expect(screen.getByText("Oct 28")).toBeInTheDocument();
    expect(screen.getByText("50 mg · 3 days ago")).toBeInTheDocument();
    expect(screen.getByText("Nov 20")).toBeInTheDocument();
    expect(screen.getByText("in about 20 days")).toBeInTheDocument();
    expect(screen.getByText(/Set aside until the next draw/)).toHaveTextContent(
      "Estradiol"
    );
    const labs = screen.getByRole("region", { name: "Labs" });
    const cards = within(labs).getAllByRole("article");
    expect(
      cards.map((c) => within(c).getByRole("heading").textContent)
    ).toEqual(["Hemoglobin", "Ferritin"]);
    expect(within(cards[0]).getByText("High")).toBeInTheDocument();
    expect(within(cards[0]).getByRole("img")).toHaveAccessibleName(
      /15.1 on Jun 1, 17.6 on Sep 1/
    );
  });

  it("lists injections newest first", () => {
    render(<NotesHealth data={VIEW_FIXTURE} />);
    const list = screen.getByRole("region", { name: "Injections" });
    const dates = within(list)
      .getAllByRole("listitem")
      .map((li) => li.querySelector("[data-date]")?.textContent);
    expect(dates).toEqual(["Oct 28, 2026", "Oct 24, 2026", "Oct 21, 2026"]);
  });

  it("is calm with no health data", () => {
    render(<NotesHealth data={EMPTY} />);
    expect(screen.getByText("No injections logged yet.")).toBeInTheDocument();
    expect(screen.getByText("No lab results yet.")).toBeInTheDocument();
  });
});

describe("NotesTraining", () => {
  it("shows recent workouts and per-movement bests", () => {
    render(<NotesTraining data={VIEW_FIXTURE} />);
    const wods = screen.getByRole("region", { name: "Recent workouts" });
    expect(within(wods).getAllByRole("listitem")).toHaveLength(2);
    expect(within(wods).getByText("8:42")).toBeInTheDocument();
    const moves = screen.getByRole("region", { name: "Movements" });
    const squat = within(moves).getByText("Back squat").closest("li");
    expect(squat).toHaveTextContent("Est. 1RM 263 lb");
    expect(squat).toHaveTextContent("1RM 255");
    expect(squat).toHaveTextContent("5RM 225");
    const pullup = within(moves).getByText("Pull-up").closest("li");
    expect(pullup).toHaveTextContent("Most 12 reps");
  });

  it("shows only the last 14 workouts", () => {
    const workouts = Array.from({ length: 20 }, (_, i) => ({
      date: `2026-09-${String(i + 1).padStart(2, "0")}`,
      type: "AMRAP",
      workout: `w${i}`,
      score: `${i}`,
      rx: "",
      note: "",
    }));
    render(
      <NotesTraining
        data={{ ...VIEW_FIXTURE, training: { lifts: [], workouts } }}
      />
    );
    const wods = screen.getByRole("region", { name: "Recent workouts" });
    expect(within(wods).getAllByRole("listitem")).toHaveLength(14);
    expect(within(wods).getByText("w19")).toBeInTheDocument();
  });

  it("is calm with nothing logged", () => {
    render(<NotesTraining data={EMPTY} />);
    expect(screen.getByText("No workouts logged yet.")).toBeInTheDocument();
  });
});

describe("NotesGolf", () => {
  it("shows the average per nine and every round, newest first", () => {
    render(<NotesGolf data={VIEW_FIXTURE} />);
    expect(screen.getByText("47")).toBeInTheDocument();
    expect(screen.getByText("over 2 counted rounds")).toBeInTheDocument();
    const rounds = screen.getByRole("region", { name: "Rounds" });
    const items = within(rounds).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Pine Hollow");
    expect(items[0]).toHaveTextContent("Scramble, not counted");
    expect(items[1]).toHaveTextContent("18 holes");
    expect(items[1]).toHaveTextContent("96");
  });

  it("is calm with no rounds", () => {
    render(<NotesGolf data={EMPTY} />);
    expect(screen.getByText("No rounds logged yet.")).toBeInTheDocument();
  });
});

describe("NotesPeople", () => {
  it("groups people and opens one", async () => {
    const onOpen = jest.fn();
    render(
      <NotesPeople
        data={VIEW_FIXTURE}
        query=""
        onQuery={jest.fn()}
        onOpen={onOpen}
      />
    );
    const headings = screen
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);
    expect(headings).toEqual(["Family 2", "Friends 1", "Work 1", "Others 1"]);
    await userEvent.click(screen.getByRole("button", { name: /Sam Okafor/ }));
    expect(onOpen).toHaveBeenCalledWith("people/sam-okafor.md");
  });

  it("filters by the search words", () => {
    render(
      <NotesPeople
        data={VIEW_FIXTURE}
        query="college"
        onQuery={jest.fn()}
        onOpen={jest.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /Jordan Lee/ })).toBeVisible();
    expect(screen.queryByText("Wren Rivera")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Search people")).toHaveValue("college");
  });

  it("says when no one matches", () => {
    render(
      <NotesPeople
        data={VIEW_FIXTURE}
        query="zzz"
        onQuery={jest.fn()}
        onOpen={jest.fn()}
      />
    );
    expect(screen.getByText("No one matches.")).toBeInTheDocument();
  });
});

describe("NotesPerson", () => {
  it("shows facts, strengths and the Markdown body with note links as labels", () => {
    const wren = VIEW_FIXTURE.people[0];
    const { container } = render(
      <NotesPerson person={wren} today="2026-10-31" onBack={jest.fn()} />
    );
    expect(
      screen.getByRole("heading", { name: "Wren Rivera" })
    ).toBeInTheDocument();
    expect(screen.getByText("Jun 16, 1990")).toBeInTheDocument();
    expect(screen.getByText("36")).toBeInTheDocument();
    expect(screen.getByText("Gemini · Metal Horse")).toBeInTheDocument();
    expect(screen.getByText("Learner")).toBeInTheDocument();
    expect(container).toHaveTextContent("Moved to a new place.");
    expect(container).not.toHaveTextContent("../home/moving.md");
    expect(container.querySelector("a")).toBeNull();
  });

  it("renders a file with odd sections and a table intact", () => {
    const sam = VIEW_FIXTURE.people[1];
    const { container } = render(
      <NotesPerson person={sam} today="2026-10-31" onBack={jest.fn()} />
    );
    expect(container.querySelector("table")).not.toBeNull();
    expect(screen.getByText("Analytical")).toBeInTheDocument();
    expect(container).toHaveTextContent("Some text with a stray | pipe.");
    expect(container).toHaveTextContent("Works on the data team.");
  });

  it("shows a died line and copes with an empty body", () => {
    const pat = VIEW_FIXTURE.people[3];
    render(
      <NotesPerson
        person={{ ...pat, body: "" }}
        today="2026-10-31"
        onBack={jest.fn()}
      />
    );
    expect(screen.getByText("Died 2010-05-01")).toBeInTheDocument();
    expect(screen.getByText("Nothing else saved yet.")).toBeInTheDocument();
  });

  it("goes back", async () => {
    const onBack = jest.fn();
    render(
      <NotesPerson
        person={VIEW_FIXTURE.people[4]}
        today="2026-10-31"
        onBack={onBack}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "People" }));
    expect(onBack).toHaveBeenCalled();
  });
});
