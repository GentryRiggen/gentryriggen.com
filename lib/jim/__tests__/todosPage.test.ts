import {
  areaSplit,
  comingUp,
  DEFAULT_FILTERS,
  doneByDay,
  dueChip,
  dueGroups,
  filterDone,
  filterTodos,
  formatFilters,
  isFiltered,
  NO_PROJECT,
  parseFilters,
  projectCounts,
  projectGroups,
  projectLabel,
  projectPath,
  todoStats,
  type TodoFilters,
} from "@/lib/jim/todosPage";
import type { ViewTodo } from "@/lib/jim/view";

const TODAY = "2026-11-01";

function todo(over: Partial<ViewTodo>): ViewTodo {
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

const TODOS: ViewTodo[] = [
  todo({
    order: 1,
    text: "Ship the pricing deck (due 2026-10-29)",
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
    project: "pet-care",
  }),
  todo({
    order: 4,
    text: "Plan the offsite (due 2026-11-06)",
    due: "2026-11-06",
    area: "work",
    project: "offsite",
  }),
  todo({
    order: 5,
    text: "Renew the passport (due 2026-12-10)",
    due: "2026-12-10",
    area: "personal",
  }),
  todo({ order: 6, text: "Read the style guide", area: "work" }),
  todo({ order: 7, text: "Sort the garage" }),
];

const DONE: ViewTodo[] = [
  todo({
    order: 10,
    text: "Pay the water bill (done 2026-10-31)",
    area: "personal",
    done: true,
    done_on: "2026-10-31",
  }),
  todo({
    order: 11,
    text: "Send the pricing notes (done 2026-11-01)",
    area: "work",
    project: "pricing-model",
    done: true,
    done_on: "2026-11-01",
  }),
  todo({
    order: 12,
    text: "Old one (done 2026-10-01)",
    area: "work",
    done: true,
    done_on: "2026-10-01",
  }),
];

function f(over: Partial<TodoFilters>): TodoFilters {
  return { ...DEFAULT_FILTERS, ...over };
}

describe("filters in the address", () => {
  it("reads nothing as the defaults", () => {
    expect(parseFilters("")).toEqual(DEFAULT_FILTERS);
  });

  it("round-trips every filter", () => {
    const all = f({
      area: "work",
      project: "pricing-model",
      when: "overdue",
      q: "deck & co",
      sort: "project",
      view: "list",
    });
    expect(parseFilters(formatFilters(all))).toEqual(all);
    const day = f({ when: "2026-11-05" });
    expect(parseFilters(formatFilters(day))).toEqual(day);
    const none = f({ project: NO_PROJECT });
    expect(parseFilters(formatFilters(none))).toEqual(none);
  });

  it("leaves the defaults out of the address", () => {
    expect(formatFilters(DEFAULT_FILTERS)).toBe("");
    expect(formatFilters(f({ area: "work" }))).toBe("?area=work");
    expect(formatFilters(f({ q: "  " }))).toBe("");
  });

  it("drops values it doesn't know", () => {
    expect(
      parseFilters(
        "?area=space&project=../x&when=soon&sort=random&view=wall&q=" +
          "x".repeat(300)
      )
    ).toEqual(f({ q: "x".repeat(100) }));
    expect(parseFilters("?when=2026-13-45")).toEqual(DEFAULT_FILTERS);
  });

  it("counts area, project, when and search as filters, not sort or view", () => {
    expect(isFiltered(DEFAULT_FILTERS)).toBe(false);
    expect(isFiltered(f({ sort: "project", view: "list" }))).toBe(false);
    expect(isFiltered(f({ area: "personal" }))).toBe(true);
    expect(isFiltered(f({ q: "vet" }))).toBe(true);
    expect(isFiltered(f({ q: "   " }))).toBe(false);
  });
});

describe("filterTodos", () => {
  const orders = (fl: Partial<TodoFilters>) =>
    filterTodos(TODOS, f(fl), TODAY).map((t) => t.order);

  it("narrows by area, then project, then when", () => {
    expect(orders({ area: "work" })).toEqual([1, 2, 4, 6]);
    expect(orders({ area: "work", project: "pricing-model" })).toEqual([1, 2]);
    expect(
      orders({ area: "work", project: "pricing-model", when: "overdue" })
    ).toEqual([1]);
    expect(orders({ area: "personal", project: NO_PROJECT })).toEqual([5]);
  });

  it("picks by when", () => {
    expect(orders({ when: "overdue" })).toEqual([1]);
    expect(orders({ when: "today" })).toEqual([2]);
    // Today through seven days out.
    expect(orders({ when: "week" })).toEqual([2, 3, 4]);
    expect(orders({ when: "later" })).toEqual([5]);
    expect(orders({ when: "nodate" })).toEqual([6, 7]);
    expect(orders({ when: "2026-11-06" })).toEqual([4]);
  });

  it("searches the full text and the short label, any case", () => {
    expect(orders({ q: "CATALOG" })).toEqual([2]);
    expect(orders({ q: "catalog copy" })).toEqual([2]);
    expect(orders({ q: "vet" })).toEqual([3]);
    expect(orders({ q: "nothing like it" })).toEqual([]);
  });

  it("sorts late first, then soonest, then undated", () => {
    expect(orders({})).toEqual([1, 2, 3, 4, 5, 6, 7]);
    const shuffled = [...TODOS].reverse();
    expect(
      filterTodos(shuffled, DEFAULT_FILTERS, TODAY).map((t) => t.order)
    ).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});

describe("filterDone", () => {
  it("keeps the last 14 days, newest first, with the area, project and search", () => {
    expect(
      filterDone(DONE, DEFAULT_FILTERS, TODAY).map((t) => t.order)
    ).toEqual([11, 10]);
    expect(
      filterDone(DONE, f({ area: "personal" }), TODAY).map((t) => t.order)
    ).toEqual([10]);
    expect(
      filterDone(DONE, f({ project: "pricing-model" }), TODAY).map(
        (t) => t.order
      )
    ).toEqual([11]);
    expect(
      filterDone(DONE, f({ q: "water" }), TODAY).map((t) => t.order)
    ).toEqual([10]);
  });

  it("narrows to a done day when the filter names one", () => {
    expect(
      filterDone(DONE, f({ when: "2026-10-31" }), TODAY).map((t) => t.order)
    ).toEqual([10]);
  });
});

describe("projectCounts", () => {
  it("counts open todos per project in the area, most first, no project last", () => {
    expect(projectCounts(TODOS, "work")).toEqual([
      { project: "pricing-model", count: 2 },
      { project: "offsite", count: 1 },
      { project: NO_PROJECT, count: 1 },
    ]);
    expect(projectCounts(TODOS, "all")).toEqual([
      { project: "pricing-model", count: 2 },
      { project: "offsite", count: 1 },
      { project: "pet-care", count: 1 },
      { project: NO_PROJECT, count: 3 },
    ]);
  });
});

describe("grouping", () => {
  it("groups by due bucket with only the buckets that have todos", () => {
    const groups = dueGroups(
      [...TODOS, todo({ order: 8, text: "Tomorrow too", due: "2026-11-02" })],
      TODAY
    );
    expect(groups.map((g) => [g.label, g.todos.map((t) => t.order)])).toEqual([
      ["Overdue", [1]],
      ["Today", [2]],
      ["Tomorrow", [3, 8]],
      ["This week", [4]],
      ["Later", [5]],
      ["No date", [6, 7]],
    ]);
  });

  it("groups by project, biggest first, no project last, each by due", () => {
    const groups = projectGroups(TODOS, (p) => p.toUpperCase());
    expect(groups.map((g) => [g.label, g.todos.map((t) => t.order)])).toEqual([
      ["PRICING-MODEL", [1, 2]],
      ["OFFSITE", [4]],
      ["PET-CARE", [3]],
      ["No project", [5, 6, 7]],
    ]);
  });
});

describe("chart data", () => {
  it("counts the tiles", () => {
    expect(todoStats(TODOS, DONE, TODAY)).toEqual({
      open: 7,
      overdue: 1,
      week: 3,
      done: 2,
    });
  });

  it("counts done per day for 14 days, zeros kept, today last", () => {
    const days = doneByDay(DONE, TODAY);
    expect(days).toHaveLength(14);
    expect(days[0]).toEqual({ day: "2026-10-19", n: 0 });
    expect(days[12]).toEqual({ day: "2026-10-31", n: 1 });
    expect(days[13]).toEqual({ day: "2026-11-01", n: 1 });
  });

  it("counts what's coming up for 14 days, late on its own", () => {
    const up = comingUp(TODOS, TODAY);
    expect(up.late).toBe(1);
    expect(up.days).toHaveLength(14);
    expect(up.days[0]).toEqual({ day: "2026-11-01", n: 1 });
    expect(up.days[1]).toEqual({ day: "2026-11-02", n: 1 });
    expect(up.days[5]).toEqual({ day: "2026-11-06", n: 1 });
    expect(up.days[13].day).toBe("2026-11-14");
    expect(up.days.reduce((s, d) => s + d.n, 0)).toBe(3);
  });

  it("splits open todos by area", () => {
    expect(areaSplit(TODOS)).toEqual({ work: 4, personal: 2, unsorted: 1 });
  });
});

describe("labels", () => {
  it("says how late, today, or the date", () => {
    expect(dueChip("2026-10-29", TODAY)).toBe("3 days late");
    expect(dueChip("2026-10-31", TODAY)).toBe("1 day late");
    expect(dueChip("2026-11-01", TODAY)).toBe("today");
    expect(dueChip("2026-11-02", TODAY)).toBe("tomorrow");
    expect(dueChip("2026-11-07", TODAY)).toBe("Nov 7");
    expect(dueChip("", TODAY)).toBe("no date");
  });

  const people = [
    { name: "Ava Torres", path: "people/ava-torres.md" },
  ] as unknown as Parameters<typeof projectLabel>[1];

  it("names a project by its person, or from its tag", () => {
    expect(projectLabel("ava-torres", people)).toBe("Ava Torres");
    expect(projectLabel("pricing-model", people)).toBe("Pricing model");
    expect(projectLabel(NO_PROJECT, people)).toBe("No project");
  });

  it("finds a project's note only when the payload names it", () => {
    expect(projectPath("ava-torres", people, [])).toBe("people/ava-torres.md");
    expect(
      projectPath("pricing-model", people, ["work/pricing-model.md"])
    ).toBe("work/pricing-model.md");
    expect(projectPath("offsite", people, ["work/pricing-model.md"])).toBe(
      null
    );
  });
});
