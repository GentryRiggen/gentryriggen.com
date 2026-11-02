import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as view from "@/lib/jim/view";
import { VIEW_FIXTURE } from "@/lib/jim/__tests__/fixtures";
import NotesTodosPage from "../NotesTodos";
import useTodoSaves from "../useTodoSaves";
import { resetTodoFilters } from "../useTodoFilters";

jest.mock("@/lib/jim/view", () => {
  const actual = jest.requireActual("@/lib/jim/view");
  return { ...actual, toggleTodo: jest.fn() };
});

const toggleTodo = jest.mocked(view.toggleTodo);

function todo(over: Partial<view.ViewTodo>): view.ViewTodo {
  return {
    text: "Something",
    due: "",
    path: "lists/todos.md",
    area: "",
    project: "",
    done: false,
    done_on: "",
    order: 1,
    ...over,
  };
}

const DATA: view.ViewData = {
  ...VIEW_FIXTURE,
  today: "2026-11-01",
  todos: [
    todo({
      order: 1,
      text: "Ship the pricing deck (due 2026-10-29) #work #pricing-model",
      due: "2026-10-29",
      area: "work",
      project: "pricing-model",
    }),
    todo({
      order: 2,
      text: "Review the catalog copy (due 2026-11-01)",
      due: "2026-11-01",
      area: "work",
      project: "pricing-model",
      short: "Catalog copy",
    }),
    todo({
      order: 3,
      text: "Call the vet (due 2026-11-02)",
      due: "2026-11-02",
      area: "personal",
      project: "ava-torres",
    }),
    todo({
      order: 4,
      text: "Plan the offsite (due 2026-11-06; every 1 week, Fridays)",
      due: "2026-11-06",
      area: "work",
      project: "offsite",
      recurring: true,
    }),
    todo({ order: 5, text: "Read the style guide", area: "work" }),
  ],
  doneTodos: [
    todo({
      order: 9,
      text: "Pay the water bill (done 2026-10-31)",
      area: "personal",
      done: true,
      done_on: "2026-10-31",
    }),
  ],
};

interface PageProps {
  data?: view.ViewData;
  onDraft?: (text: string) => void;
  onOpenNote?: (path: string) => void;
}

function Page({
  data = DATA,
  onDraft = () => {},
  onOpenNote = () => {},
}: PageProps) {
  const saves = useTodoSaves({
    data,
    api: "https://jim.example.test",
    getToken: async () => "t",
    onChanged: async () => data,
  });
  return (
    <NotesTodosPage
      data={data}
      saves={saves}
      onDraft={onDraft}
      wide={false}
      entryKey="k"
      navType="initial"
      onOpenNote={onOpenNote}
      hrefForNote={(path) => `/jim/notes/note/${path.replace(/\.md$/, "")}`}
    />
  );
}

/** The titles in the open list, in order. */
function titles(): string[] {
  const list = screen.getByRole("region", { name: /open todos/i });
  return within(list)
    .getAllByRole("checkbox")
    .map((b) => b.getAttribute("aria-label") ?? "");
}

beforeEach(() => {
  toggleTodo.mockReset();
  window.history.replaceState(null, "", "/jim/todos");
});

it("lists every open todo by due bucket, late first, with a count", () => {
  render(<Page />);
  expect(screen.getByText("5 todos")).toBeInTheDocument();
  expect(titles()).toEqual([
    "Ship the pricing deck",
    "Review the catalog copy",
    "Call the vet",
    "Plan the offsite",
    "Read the style guide",
  ]);
  const list = screen.getByRole("region", { name: /open todos/i });
  for (const h of ["Overdue", "Today", "Tomorrow", "This week", "No date"]) {
    expect(
      within(list).getByRole("heading", { name: new RegExp(`^${h}`) })
    ).toBeInTheDocument();
  }
  expect(within(list).getByText("3 days late")).toBeInTheDocument();
  expect(within(list).getByText("Nov 6")).toBeInTheDocument();
  expect(within(list).getByLabelText("Repeats")).toBeInTheDocument();
});

it("filters Work, then a project, then overdue, and keeps it in the address", async () => {
  const user = userEvent.setup();
  render(<Page />);
  await user.click(screen.getByRole("radio", { name: "Work" }));
  expect(titles()).toHaveLength(4);
  expect(window.location.search).toBe("?area=work");
  const projects = screen.getByRole("group", { name: "Projects" });
  // Projects in Work, most todos first, with their counts.
  expect(
    within(projects)
      .getAllByRole("button")
      .map((b) => b.textContent)
  ).toEqual(["All projects", "Pricing model2", "Offsite1", "No project1"]);
  await user.click(
    within(projects).getByRole("button", { name: /Pricing model/ })
  );
  expect(titles()).toEqual([
    "Ship the pricing deck",
    "Review the catalog copy",
  ]);
  await user.click(screen.getByRole("button", { name: "Overdue" }));
  expect(titles()).toEqual(["Ship the pricing deck"]);
  expect(screen.getByText("1 todo")).toBeInTheDocument();
  expect(window.location.search).toBe(
    "?area=work&project=pricing-model&when=overdue"
  );
  await user.click(screen.getByRole("button", { name: "Clear" }));
  expect(titles()).toHaveLength(5);
  expect(window.location.search).toBe("");
});

it("opens with the filters its address names", () => {
  window.history.replaceState(null, "", "/jim/todos?area=personal&q=VET");
  render(<Page />);
  expect(titles()).toEqual(["Call the vet"]);
  expect(screen.getByRole("radio", { name: "Personal" })).toHaveAttribute(
    "aria-checked",
    "true"
  );
  expect(screen.getByRole("searchbox", { name: "Search todos" })).toHaveValue(
    "VET"
  );
});

it("searches the full text and the short label", async () => {
  const user = userEvent.setup();
  render(<Page />);
  const box = screen.getByRole("searchbox", { name: "Search todos" });
  await user.type(box, "catalog copy");
  expect(titles()).toEqual(["Review the catalog copy"]);
  await user.clear(box);
  await user.type(box, "nothing like this");
  expect(screen.getByText(/No todos match/)).toBeInTheDocument();
});

it("says so kindly when nothing is overdue", async () => {
  const user = userEvent.setup();
  window.history.replaceState(null, "", "/jim/todos?area=personal");
  render(<Page />);
  await user.click(screen.getByRole("button", { name: "Overdue" }));
  expect(screen.getByText("Nothing overdue. Nice.")).toBeInTheDocument();
});

it("ticks a todo with its full line and offers Undo, as Home does", async () => {
  const user = userEvent.setup();
  toggleTodo.mockResolvedValue({ ok: true, sha: null });
  render(<Page />);
  await user.click(
    screen.getByRole("checkbox", { name: "Ship the pricing deck" })
  );
  expect(toggleTodo).toHaveBeenCalledWith(
    expect.objectContaining({
      order: 1,
      text: "Ship the pricing deck (due 2026-10-29) #work #pricing-model",
      area: "work",
      project: "pricing-model",
    }),
    true,
    expect.any(Function),
    undefined,
    "https://jim.example.test"
  );
  expect(
    await screen.findByRole("button", { name: "Undo" })
  ).toBeInTheDocument();
});

it("lists what was done in a closed section, and unticks it", async () => {
  const user = userEvent.setup();
  toggleTodo.mockResolvedValue({ ok: true, sha: null });
  render(<Page />);
  const summary = screen.getByText(/Done in the last 14 days/);
  expect(summary.textContent).toMatch(/\(1\)/);
  expect(summary.closest("details")).not.toHaveAttribute("open");
  await user.click(summary);
  const box = screen.getByRole("checkbox", { name: "Pay the water bill" });
  expect(box).toHaveAttribute("aria-checked", "true");
  await user.click(box);
  expect(toggleTodo).toHaveBeenCalledWith(
    expect.objectContaining({
      text: "Pay the water bill (done 2026-10-31)",
    }),
    false,
    expect.any(Function),
    undefined,
    "https://jim.example.test"
  );
});

it("filters from a chart: Late, a day, the tiles and the area bar", async () => {
  const user = userEvent.setup();
  render(<Page />);
  await user.click(screen.getByRole("button", { name: "Late: 1 todo" }));
  expect(titles()).toEqual(["Ship the pricing deck"]);
  expect(window.location.search).toBe("?when=overdue");
  await user.click(screen.getByRole("button", { name: "Fri, Nov 6: 1 due" }));
  expect(titles()).toEqual(["Plan the offsite"]);
  expect(window.location.search).toBe("?when=2026-11-06");
  await user.click(screen.getByRole("button", { name: /^Open/ }));
  expect(titles()).toHaveLength(5);
  await user.click(screen.getByRole("button", { name: "Personal: 1 todo" }));
  expect(titles()).toEqual(["Call the vet"]);
  await user.click(screen.getByRole("button", { name: /^Done in 14 days/ }));
  expect(screen.getByRole("region", { name: /recently done/i })).toBeVisible();
});

it("describes each chart for a screen reader", () => {
  render(<Page />);
  expect(
    screen.getByRole("group", { name: /^Coming up\. 1 late; 3 todos due/ })
  ).toBeInTheDocument();
  expect(
    screen.getByRole("group", { name: /^Done per day\. 1 done in 14 days/ })
  ).toBeInTheDocument();
  expect(
    screen.getByRole("group", { name: /Work 4 \(80%\), Personal 1 \(20%\)/ })
  ).toBeInTheDocument();
});

it("groups by project when sorted that way", async () => {
  const user = userEvent.setup();
  render(<Page />);
  await user.click(screen.getByRole("radio", { name: "Project" }));
  const list = screen.getByRole("region", { name: /open todos/i });
  expect(
    within(list)
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent)
  ).toEqual(["Pricing model2", "Ava Torres1", "Offsite1", "No project1"]);
  expect(window.location.search).toBe("?sort=project");
});

it("links a project to its note when the payload knows it, else filters", async () => {
  const user = userEvent.setup();
  const onOpenNote = jest.fn();
  render(<Page onOpenNote={onOpenNote} />);
  const list = screen.getByRole("region", { name: /open todos/i });
  const person = within(list).getByRole("link", { name: "Ava Torres" });
  expect(person).toHaveAttribute("href", "/jim/notes/note/people/ava-torres");
  await user.click(person);
  expect(onOpenNote).toHaveBeenCalledWith("people/ava-torres.md");
  await user.click(
    within(list).getByRole("button", { name: "Show Offsite todos" })
  );
  expect(titles()).toEqual(["Plan the offsite"]);
});

it("asks Jim about a todo, and starts a new one, in the chat box", async () => {
  const user = userEvent.setup();
  const onDraft = jest.fn();
  render(<Page onDraft={onDraft} />);
  await user.click(
    screen.getByRole("button", { name: "Ask Jim about Call the vet" })
  );
  expect(onDraft).toHaveBeenCalledWith(
    "Help me with: Call the vet (due 2026-11-02)"
  );
  await user.click(screen.getByRole("button", { name: "New todo" }));
  expect(onDraft).toHaveBeenLastCalledWith("Add a todo: ");
});

it("hides the charts on request, and remembers it in the address", async () => {
  const user = userEvent.setup();
  render(<Page />);
  await user.click(screen.getByRole("button", { name: "Hide charts" }));
  expect(screen.queryByRole("group", { name: /^Coming up/ })).toBeNull();
  expect(window.location.search).toBe("?view=list");
  await user.click(screen.getByRole("button", { name: "Show charts" }));
  expect(screen.getByRole("group", { name: /^Coming up/ })).toBeInTheDocument();
});

describe("the address under fast typing", () => {
  it("filters on every key but writes the search to the address once typing pauses", async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const spy = jest.spyOn(window.history, "replaceState");
    try {
      render(<Page />);
      spy.mockClear();
      await user.type(
        screen.getByRole("searchbox", { name: "Search todos" }),
        "catalog copy"
      );
      expect(titles()).toEqual(["Review the catalog copy"]);
      expect(spy).not.toHaveBeenCalled();
      act(() => {
        jest.advanceTimersByTime(300);
      });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(window.location.search).toBe("?q=catalog+copy");
    } finally {
      spy.mockRestore();
      jest.useRealTimers();
    }
  });

  it("keeps working when the browser refuses to change the address", async () => {
    const user = userEvent.setup();
    const spy = jest
      .spyOn(window.history, "replaceState")
      .mockImplementation(() => {
        throw new DOMException("too many calls", "SecurityError");
      });
    try {
      render(<Page />);
      await user.click(screen.getByRole("radio", { name: "Work" }));
      expect(titles()).toHaveLength(4);
    } finally {
      spy.mockRestore();
    }
  });
});

it("lights the Open tile when no when filter is on", async () => {
  const user = userEvent.setup();
  render(<Page />);
  expect(screen.getByRole("button", { name: /^Open/ })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await user.click(screen.getByRole("button", { name: "Overdue 1" }));
  expect(screen.getByRole("button", { name: /^Open/ })).toHaveAttribute(
    "aria-pressed",
    "false"
  );
});

it("drops the When row in done mode until a day is picked", async () => {
  const user = userEvent.setup();
  render(<Page />);
  await user.click(screen.getByRole("radio", { name: "Recently done" }));
  expect(screen.queryByRole("group", { name: "When" })).toBeNull();
});

it("moves through Area with the arrow keys, one tab stop", async () => {
  const user = userEvent.setup();
  render(<Page />);
  const all = screen.getByRole("radio", { name: "All" });
  expect(all).toHaveAttribute("tabindex", "0");
  expect(screen.getByRole("radio", { name: "Work" })).toHaveAttribute(
    "tabindex",
    "-1"
  );
  all.focus();
  await user.keyboard("{ArrowRight}");
  const work = screen.getByRole("radio", { name: "Work" });
  expect(work).toHaveFocus();
  expect(work).toHaveAttribute("aria-checked", "true");
  await user.keyboard("{ArrowLeft}{ArrowLeft}");
  expect(screen.getByRole("radio", { name: "Personal" })).toHaveFocus();
});

it("resets its filters when Todos is picked again", async () => {
  const user = userEvent.setup();
  render(<Page />);
  await user.click(screen.getByRole("radio", { name: "Work" }));
  act(() => resetTodoFilters());
  expect(titles()).toHaveLength(5);
  expect(window.location.search).toBe("");
});
