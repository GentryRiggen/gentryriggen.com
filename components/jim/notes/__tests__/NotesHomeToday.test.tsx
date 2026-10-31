import { act, render, screen, within } from "@testing-library/react";
import { VIEW_FIXTURE } from "@/lib/jim/__tests__/fixtures";
import type { ViewData } from "@/lib/jim/view";
import NotesHome from "../NotesHome";

const HOME = {
  saves: { marks: {}, toast: null, toggle: () => {}, undo: () => {} },
  onLog: () => {},
};

function renderAt(iso: string, data: ViewData = VIEW_FIXTURE) {
  jest.useFakeTimers({ now: new Date(iso), doNotFake: ["queueMicrotask"] });
  render(<NotesHome data={data} {...HOME} />);
}

afterEach(() => jest.useRealTimers());

it("puts a Today card first: next meeting, last injection, workouts this week", () => {
  renderAt("2026-10-31T13:00:00Z");
  const card = screen.getByRole("region", { name: "Today" });
  const regions = screen.getAllByRole("region").map((r) => r.id || r);
  expect(regions[0]).toBe(card.id || card);
  const rows = within(card)
    .getAllByRole("listitem")
    .map((li) => li.textContent);
  expect(rows).toEqual([
    expect.stringMatching(/^Next\s*\S+\s*Team standup$/),
    "Injection3 days ago",
    "Workouts this week1",
  ]);
});

it("shows only the rows it has data for", () => {
  renderAt("2026-10-31T23:00:00Z", {
    ...VIEW_FIXTURE,
    health: { ...VIEW_FIXTURE.health, injections: [] },
  });
  const card = screen.getByRole("region", { name: "Today" });
  expect(within(card).getAllByRole("listitem")).toHaveLength(1);
  expect(within(card).getByText("Workouts this week")).toBeInTheDocument();
});

it("hides the card when there is nothing to show", () => {
  renderAt("2026-10-31T13:00:00Z", {
    ...VIEW_FIXTURE,
    calendar: null,
    health: { ...VIEW_FIXTURE.health, injections: [] },
    training: { lifts: [], workouts: [] },
  });
  expect(screen.queryByRole("region", { name: "Today" })).toBeNull();
});

it("moves on to the next meeting as the clock passes the last one", () => {
  // Standup runs 16:00 to its end; afterwards nothing is left today.
  renderAt("2026-10-31T15:00:00Z");
  const card = () => screen.getByRole("region", { name: "Today" });
  expect(within(card()).getByText(/Team standup/)).toBeInTheDocument();
  act(() => {
    jest.advanceTimersByTime(4 * 60 * 60 * 1000);
  });
  expect(within(card()).queryByText(/Team standup/)).toBeNull();
});
