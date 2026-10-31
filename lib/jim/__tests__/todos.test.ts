import {
  doneLine,
  withoutDone,
  addDays,
  daysBetween,
  dueLabel,
  fmtShort,
  groupTodos,
  isRecurring,
  todoTitle,
} from "../todos";
import { VIEW_FIXTURE } from "./fixtures";

const TODAY = VIEW_FIXTURE.today;

describe("dates", () => {
  it("counts whole days between ISO dates, across month ends", () => {
    expect(daysBetween("2026-10-31", "2026-11-01")).toBe(1);
    expect(daysBetween("2026-10-31", "2026-10-29")).toBe(-2);
    expect(daysBetween("2026-10-31", "2026-10-31")).toBe(0);
    // Across the US daylight-saving change (Nov 1, 2026) it stays whole.
    expect(daysBetween("2026-10-30", "2026-11-03")).toBe(4);
  });

  it("adds days", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("formats a short day like the Mac viewer", () => {
    expect(fmtShort("2026-11-02")).toBe("Nov 2");
  });
});

describe("todoTitle", () => {
  it("drops the due date, markdown, links and a trailing See pointer", () => {
    expect(
      todoTitle(
        "Send the **quarterly** report (due 2026-10-29). See [notes](../work/report.md)"
      )
    ).toBe("Send the quarterly report");
  });

  it("drops a recurring due-and-every group", () => {
    expect(
      todoTitle("Water the plants (due 2026-10-31; every 1 week, Saturdays)")
    ).toBe("Water the plants");
  });

  it("drops trailing tags if they are still there", () => {
    expect(todoTitle("Call the bank (due 2026-11-01) #personal #money")).toBe(
      "Call the bank"
    );
  });

  it("keeps a # that is not a trailing tag", () => {
    expect(todoTitle("Fix issue #42 in the tracker")).toBe(
      "Fix issue #42 in the tracker"
    );
  });
});

describe("isRecurring", () => {
  it("spots every N days, weeks, months", () => {
    expect(isRecurring("x (due 2026-10-31; every 1 week, Mondays)")).toBe(true);
    expect(isRecurring("x (due 2026-10-31; every 3 days)")).toBe(true);
    expect(isRecurring("Read every book on the shelf")).toBe(false);
  });
});

describe("groupTodos", () => {
  it("puts overdue first, then today, the next 7 days, then later", () => {
    const g = groupTodos(VIEW_FIXTURE.todos, TODAY);
    const titles = (list: typeof g.overdue) =>
      list.map((t) => todoTitle(t.text));
    // Oldest overdue first.
    expect(titles(g.overdue)).toEqual([
      "File the expense report",
      "Send the quarterly report",
    ]);
    expect(titles(g.today)).toEqual(["Water the plants"]);
    expect(titles(g.week)).toEqual([
      "Renew the car registration",
      "Draft the onboarding plan",
    ]);
    // Dated before undated.
    expect(titles(g.later)).toEqual([
      "Book the dentist",
      "Read the new style guide",
    ]);
  });

  it("counts day 7 as this week and day 8 as later", () => {
    const base = VIEW_FIXTURE.todos[0];
    const g = groupTodos(
      [
        { ...base, text: "a", due: "2026-11-07", order: 1 },
        { ...base, text: "b", due: "2026-11-08", order: 2 },
      ],
      TODAY
    );
    expect(g.week.map((t) => t.text)).toEqual(["a"]);
    expect(g.later.map((t) => t.text)).toEqual(["b"]);
  });

  it("keeps file order for todos due the same day", () => {
    const base = VIEW_FIXTURE.todos[0];
    const g = groupTodos(
      [
        { ...base, text: "second", due: TODAY, order: 9 },
        { ...base, text: "first", due: TODAY, order: 3 },
      ],
      TODAY
    );
    expect(g.today.map((t) => t.text)).toEqual(["first", "second"]);
  });

  it("leaves out done todos", () => {
    const base = VIEW_FIXTURE.todos[0];
    const g = groupTodos([{ ...base, due: TODAY, done: true }], TODAY);
    expect(g.today).toEqual([]);
  });
});

describe("dueLabel", () => {
  it("labels like the Mac Home", () => {
    expect(dueLabel("2026-10-29", TODAY)).toBe("2d late");
    expect(dueLabel("2026-10-31", TODAY)).toBe("today");
    expect(dueLabel("2026-11-01", TODAY)).toBe("tomorrow");
    expect(dueLabel("2026-11-05", TODAY)).toBe("in 5d");
    expect(dueLabel("2026-11-15", TODAY)).toBe("Nov 15");
    expect(dueLabel("", TODAY)).toBe("no date");
  });
});

describe("doneLine", () => {
  const todo = {
    text: "Water the plants (due 2026-10-31)",
    due: "2026-10-31",
    path: "lists/todos.md",
    area: "personal",
    project: "",
    done: false,
    done_on: "",
    order: 3,
  };
  const done = (order: number, extra: Partial<typeof todo> = {}) => ({
    ...todo,
    text: "Water the plants (due 2026-10-31) (done 2026-10-31)",
    done: true,
    done_on: "2026-10-31",
    order,
    ...extra,
  });

  it("finds the checked-off line by its text without the done stamp", () => {
    expect(
      doneLine({ todos: [], doneTodos: [done(9), done(4)] }, todo)
    ).toMatchObject({ order: 4 });
    expect(withoutDone(done(4).text)).toBe(todo.text);
  });

  it("tells apart lines that differ only in their tags, and open lines", () => {
    expect(
      doneLine(
        {
          todos: [{ ...todo, order: 5 }],
          doneTodos: [done(3, { area: "work" }), done(3, { project: "yard" })],
        },
        todo
      )
    ).toBeNull();
  });
});
