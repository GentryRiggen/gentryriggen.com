import { normalizeMoney } from "@/lib/jim/money";
import {
  formatJimPath,
  homePageOf,
  isDetail,
  movementSlug,
  parseJimPath,
  routeTitle,
  sameRoute,
  type JimRoute,
} from "@/lib/jim/routes";
import { normalizeView } from "@/lib/jim/view";
import { MONEY_FIXTURE, VIEW_FIXTURE } from "./fixtures";

/** The view payload with its first meeting replaced. */
function withMeeting(meeting: Record<string, unknown>) {
  const work = VIEW_FIXTURE.work!;
  return normalizeView({
    ...VIEW_FIXTURE,
    work: { ...work, meetings: [{ ...work.meetings[1], ...meeting }] },
  });
}

describe("meetings' newer fields", () => {
  it("keeps series, decisions, steps and an https transcript", () => {
    const m = normalizeView(VIEW_FIXTURE)!.work!.meetings[0];
    expect(m.series).toBe("Garden sync");
    expect(m.decisions).toEqual(["Spring beds go along the south fence"]);
    expect(m.steps).toEqual([
      { who: "You", text: "Order the cedar boards", mine: true },
      { who: "Ava Torres", text: "Sketch the bed layout", mine: false },
      { who: "", text: "Check the soil test results", mine: false },
    ]);
    expect(m.transcript).toBe("https://notes.example.test/t/1");
  });

  it("defaults them on an older server", () => {
    const m = normalizeView(VIEW_FIXTURE)!.work!.meetings[1];
    expect(m).toMatchObject({
      series: "",
      decisions: [],
      steps: [],
      transcript: "",
    });
  });

  it("drops malformed steps and decisions, and caps them", () => {
    const m = withMeeting({
      series: 7,
      decisions: [
        "Keep",
        3,
        "",
        ...Array.from({ length: 12 }, (_, i) => `D${i}`),
      ],
      steps: [
        { who: "Priya Lane", text: "Call back", mine: "yes" },
        { who: 1, text: "Bad owner" },
        { who: "", text: "" },
        null,
        ...Array.from({ length: 20 }, (_, i) => ({ who: "", text: `S${i}` })),
      ],
      transcript: "javascript:alert(1)",
    })!.work!.meetings[0];
    expect(m.series).toBe("");
    expect(m.decisions).toHaveLength(10);
    expect(m.decisions![0]).toBe("Keep");
    expect(m.steps).toHaveLength(15);
    // A non-boolean `mine` is not mine.
    expect(m.steps![0]).toEqual({
      who: "Priya Lane",
      text: "Call back",
      mine: false,
    });
    expect(m.transcript).toBe("");
  });

  it("refuses a plain-http transcript", () => {
    const m = withMeeting({ transcript: "http://notes.example.test/t" })!.work!
      .meetings[0];
    expect(m.transcript).toBe("");
  });
});

describe("mindset", () => {
  it("keeps the stats, threads sorted by count", () => {
    const view = normalizeView({
      ...VIEW_FIXTURE,
      mindset: {
        ...VIEW_FIXTURE.mindset,
        threads: [
          { name: "A", count: 1 },
          { name: "B", count: 4 },
          { name: "", count: 2 },
          { name: "C", count: 0 },
          { name: "D" },
        ],
      },
    })!;
    expect(view.mindset).toMatchObject({
      sessions: 12,
      streak: 4,
      reflections: 3,
      intention: "Listen before answering",
    });
    expect(view.mindset!.threads).toEqual([
      { name: "B", count: 4 },
      { name: "A", count: 1 },
    ]);
  });

  it("is null when malformed, absent from an older server", () => {
    expect(
      normalizeView({ ...VIEW_FIXTURE, mindset: { sessions: "12" } })!.mindset
    ).toBeNull();
    expect(
      normalizeView({ ...VIEW_FIXTURE, mindset: null })!.mindset
    ).toBeNull();
    const { mindset: _drop, ...older } = VIEW_FIXTURE;
    void _drop;
    expect(normalizeView(older)!.mindset).toBeUndefined();
  });

  it("keeps at most five recent sessions, dropping empty ones", () => {
    const recent = [
      { date: "2026-10-01", text: "" },
      ...Array.from({ length: 7 }, (_, i) => ({
        date: "2026-10-02",
        text: `R${i}`,
      })),
    ];
    const view = normalizeView({
      ...VIEW_FIXTURE,
      mindset: { ...VIEW_FIXTURE.mindset, recent },
    })!;
    expect(view.mindset!.recent.map((r) => r.text)).toEqual([
      "R0",
      "R1",
      "R2",
      "R3",
      "R4",
    ]);
  });
});

describe("yearDates", () => {
  it("keeps good rows sorted by date, with gift text", () => {
    const view = normalizeView({
      ...VIEW_FIXTURE,
      yearDates: [
        VIEW_FIXTURE.yearDates![2],
        { ...VIEW_FIXTURE.yearDates![0], kind: "holiday" },
        { ...VIEW_FIXTURE.yearDates![0], on: "Nov 3" },
        { ...VIEW_FIXTURE.yearDates![1], gift: 4 },
        VIEW_FIXTURE.yearDates![0],
      ],
    })!;
    expect(view.yearDates!.map((d) => [d.name, d.gift])).toEqual([
      ["Jordan Lee", "2 gift ideas, none chosen."],
      ["Library card", ""],
      ["Sam Okafor", "Gift chosen."],
    ]);
  });

  it("keeps approx and unsure only when they are exactly true", () => {
    const view = normalizeView({
      ...VIEW_FIXTURE,
      yearDates: [
        VIEW_FIXTURE.yearDates![0],
        { ...VIEW_FIXTURE.yearDates![2], approx: "yes", unsure: 1 },
        { ...VIEW_FIXTURE.yearDates![3], approx: undefined },
      ],
    })!;
    expect(view.yearDates!.map((d) => [d.approx, d.unsure])).toEqual([
      [false, true],
      [false, false],
      [false, false],
    ]);
  });

  it("is absent from an older server", () => {
    const { yearDates: _drop, ...older } = VIEW_FIXTURE;
    void _drop;
    expect(normalizeView(older)!.yearDates).toBeUndefined();
  });
});

describe("money's newer sections", () => {
  it("keeps the grid, share and Amazon as sent", () => {
    const money = normalizeMoney(MONEY_FIXTURE)!;
    expect(money.grid).toEqual(MONEY_FIXTURE.grid);
    expect(money.share).toEqual(MONEY_FIXTURE.share);
    expect(money.amazon).toEqual(MONEY_FIXTURE.amazon);
  });

  it("is null for each when an older server leaves it out", () => {
    const { grid: _g, share: _s, amazon: _a, ...older } = MONEY_FIXTURE;
    void [_g, _s, _a];
    const money = normalizeMoney(older)!;
    expect(money.grid).toBeNull();
    expect(money.share).toBeNull();
    expect(money.amazon).toBeNull();
  });

  it("drops grid rows that don't line up with the months", () => {
    const money = normalizeMoney({
      ...MONEY_FIXTURE,
      grid: {
        months: ["2026-08", "2026-09"],
        rows: [
          {
            cat: "Seeds",
            group: "Garden",
            values: [1, null],
            typical: 2,
            flags: ["hi", "odd"],
          },
          { cat: "Short", group: "Garden", values: [1], typical: 2, flags: [] },
          { cat: "Text", group: "Garden", values: ["1", 2], typical: 2 },
          { cat: "", group: "Garden", values: [1, 2], typical: 2 },
        ],
      },
    })!;
    expect(money.grid!.rows).toEqual([
      {
        cat: "Seeds",
        group: "Garden",
        fixed: false,
        note: "",
        values: [1, null],
        typical: 2,
        flags: ["hi", ""],
      },
    ]);
  });

  it("drops a grid with bad months, or with no good rows", () => {
    expect(
      normalizeMoney({ ...MONEY_FIXTURE, grid: { months: ["Aug"], rows: [] } })!
        .grid
    ).toBeNull();
    expect(
      normalizeMoney({
        ...MONEY_FIXTURE,
        grid: { months: ["2026-08"], rows: [{ cat: "x" }] },
      })!.grid
    ).toBeNull();
  });

  it("drops a share without its line", () => {
    expect(
      normalizeMoney({
        ...MONEY_FIXTURE,
        share: { perMonth: 1, afterAvg: 2, line: " " },
      })!.share
    ).toBeNull();
  });

  it("drops malformed Amazon rows and caps the lists", () => {
    const amazon = normalizeMoney({
      ...MONEY_FIXTURE,
      amazon: {
        months: [
          {
            m: "2026-09",
            label: "Sep",
            partial: false,
            total: 5,
            byCat: { A: 5, B: "x" },
          },
          { m: "Sep", label: "Sep", total: 5 },
        ],
        cats: ["A", 2, ""],
        repeats: Array.from({ length: 20 }, (_, i) => ({
          n: 3,
          item: `R${i}`,
          category: "A",
          total: 9,
        })),
        items: [
          ...Array.from({ length: 310 }, () => ({
            date: "2026-09-01",
            item: "Thing",
            amount: -1,
            category: "A",
          })),
          { date: "2026-09-01", item: "Bad", amount: "1", category: "A" },
        ],
      },
    })!.amazon!;
    expect(amazon.months).toEqual([
      { m: "2026-09", label: "Sep", partial: false, total: 5, byCat: { A: 5 } },
    ]);
    expect(amazon.cats).toEqual(["A"]);
    expect(amazon.repeats).toHaveLength(15);
    expect(amazon.items).toHaveLength(300);
  });

  it("drops Amazon with no good months", () => {
    expect(
      normalizeMoney({ ...MONEY_FIXTURE, amazon: { months: [], items: [] } })!
        .amazon
    ).toBeNull();
  });
});

describe("the new addresses", () => {
  it.each<[string, JimRoute]>([
    ["/jim/notes/year", { kind: "page", page: "year" }],
    ["/jim/notes/mindset", { kind: "page", page: "mindset" }],
    ["/jim/notes/timeline", { kind: "page", page: "timeline" }],
    ["/jim/notes/graph", { kind: "page", page: "graph" }],
    ["/jim/notes/ballot", { kind: "page", page: "ballot" }],
    [
      "/jim/notes/training/m/back-squat",
      { kind: "movement", slug: "back-squat" },
    ],
    [
      "/jim/notes/training/day/2026-10-15",
      { kind: "trainingDay", date: "2026-10-15" },
    ],
  ])("%s round-trips", (path, route) => {
    expect(parseJimPath(path)).toEqual(route);
    expect(formatJimPath(route)).toBe(path);
    expect(isDetail(route)).toBe(route.kind !== "page");
  });

  it.each([
    "/jim/notes/training/m/Back%20Squat",
    "/jim/notes/training/m/..",
    "/jim/notes/training/m",
    "/jim/notes/training/day/2026-10",
    "/jim/notes/training/day/yesterday",
    "/jim/notes/training/week/2026-10-15",
    "/jim/notes/training/m/a/b",
  ])("%s is not found", (path) => {
    expect(parseJimPath(path)).toEqual({ kind: "notFound" });
  });

  it("files training pages under Training", () => {
    expect(homePageOf({ kind: "movement", slug: "a" })).toBe("training");
    expect(homePageOf({ kind: "trainingDay", date: "2026-10-15" })).toBe(
      "training"
    );
    expect(routeTitle({ kind: "movement", slug: "a" }, "Back squat")).toBe(
      "Back squat · Jim"
    );
    expect(routeTitle({ kind: "trainingDay", date: "2026-10-15" })).toBe(
      "Training · Jim"
    );
  });

  it("compares training routes by slug and date", () => {
    expect(
      sameRoute(
        { kind: "movement", slug: "a" },
        { kind: "movement", slug: "a" }
      )
    ).toBe(true);
    expect(
      sameRoute(
        { kind: "movement", slug: "a" },
        { kind: "movement", slug: "b" }
      )
    ).toBe(false);
    expect(
      sameRoute(
        { kind: "trainingDay", date: "2026-10-15" },
        { kind: "trainingDay", date: "2026-10-16" }
      )
    ).toBe(false);
  });

  it("slugs a movement name into one address segment", () => {
    expect(movementSlug("Back squat")).toBe("back-squat");
    expect(movementSlug("  Push press (strict) ")).toBe("push-press-strict");
    expect(movementSlug("Pull-up")).toBe("pull-up");
    expect(movementSlug("Wall ball 20#")).toBe("wall-ball-20");
    const slug = movementSlug("Back squat");
    expect(parseJimPath(`/jim/notes/training/m/${slug}`)).toEqual({
      kind: "movement",
      slug,
    });
  });
});
