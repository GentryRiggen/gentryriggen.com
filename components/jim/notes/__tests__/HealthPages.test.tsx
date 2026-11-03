import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VIEW_FIXTURE } from "@/lib/jim/__tests__/fixtures";
import NotesMindset from "../NotesMindset";
import NotesTraining from "../NotesTraining";
import { TrainingDayPage, TrainingMovement } from "../TrainingPages";

function links() {
  return {
    onOpenMovement: jest.fn(),
    movementHref: (slug: string) => `/jim/notes/training/m/${slug}`,
    onOpenDay: jest.fn(),
    dayHref: (date: string) => `/jim/notes/training/day/${date}`,
  };
}

const BACK = { onBack: () => {}, backLabel: "Training" };

describe("NotesMindset", () => {
  it("shows the tiles, intention, threads and recent sessions", () => {
    render(<NotesMindset data={VIEW_FIXTURE} />);
    expect(screen.getByText("Sessions").nextSibling).toHaveTextContent("12");
    expect(screen.getByText("Day streak").nextSibling).toHaveTextContent("4");
    expect(screen.getByText("“Listen before answering”")).toBeInTheDocument();
    const threads = screen.getByRole("list", { name: "Threads by mentions" });
    expect(within(threads).getAllByRole("listitem")[0]).toHaveTextContent(
      "Patience5 mentions"
    );
    expect(
      screen.getByText("Sat for ten minutes with the rain")
    ).toBeInTheDocument();
  });

  it("says calmly when there is no mindset data", () => {
    render(<NotesMindset data={{ ...VIEW_FIXTURE, mindset: undefined }} />);
    expect(screen.getByText(/No mindset sessions yet/)).toBeInTheDocument();
  });
});

describe("Training links", () => {
  it("links each movement and workout day to its page", async () => {
    const user = userEvent.setup();
    const l = links();
    render(<NotesTraining data={VIEW_FIXTURE} links={l} />);
    const squat = screen.getByRole("link", { name: "Back squat" });
    expect(squat).toHaveAttribute("href", "/jim/notes/training/m/back-squat");
    await user.click(squat);
    expect(l.onOpenMovement).toHaveBeenCalledWith("back-squat");
    await user.click(screen.getByRole("link", { name: "Wed, Oct 28" }));
    expect(l.onOpenDay).toHaveBeenCalledWith("2026-10-28");
  });
});

describe("TrainingMovement", () => {
  it("shows tiles, a year calendar, rep maxes and every entry with PRs", () => {
    render(
      <TrainingMovement
        training={VIEW_FIXTURE.training}
        slug="back-squat"
        today="2026-10-31"
        links={links()}
        {...BACK}
      />
    );
    expect(
      screen.getByRole("heading", { name: "Back squat" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /done on 2 days in the past year/ })
    ).toBeInTheDocument();
    expect(screen.getByText("5RM")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /Estimated one-rep max over 2 days/ })
    ).toBeInTheDocument();
    const entries = screen.getByRole("region", { name: "Every entry" });
    expect(within(entries).getAllByText("PR")).toHaveLength(2);
    expect(within(entries).getByText("felt good")).toBeInTheDocument();
  });

  it("says so for an unknown movement", () => {
    render(
      <TrainingMovement
        training={VIEW_FIXTURE.training}
        slug="snatch"
        today="2026-10-31"
        links={links()}
        {...BACK}
      />
    );
    expect(screen.getByText(/isn.t in the lift log/)).toBeInTheDocument();
  });
});

describe("TrainingDayPage", () => {
  it("shows the day's workouts and lifts with neighbor days", async () => {
    const user = userEvent.setup();
    const l = links();
    render(
      <TrainingDayPage
        training={VIEW_FIXTURE.training}
        date="2026-10-22"
        links={l}
        {...BACK}
      />
    );
    expect(screen.getByText("AMRAP 12")).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Box jump" }));
    expect(l.onOpenMovement).toHaveBeenCalledWith("box-jump");
    const nav = screen.getByRole("navigation", { name: "Other training days" });
    await user.click(within(nav).getByRole("link", { name: "‹ Oct 20" }));
    expect(l.onOpenDay).toHaveBeenCalledWith("2026-10-20");
  });

  it("says so for a day with nothing logged", () => {
    render(
      <TrainingDayPage
        training={VIEW_FIXTURE.training}
        date="2026-01-01"
        links={links()}
        {...BACK}
      />
    );
    expect(screen.getByText("Nothing logged that day.")).toBeInTheDocument();
  });
});
