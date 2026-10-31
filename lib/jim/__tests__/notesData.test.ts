import {
  ageOn,
  chineseZodiac,
  eventsByDay,
  golfSummary,
  labCards,
  movementBests,
  personFacts,
  personGroup,
  sunSign,
} from "../notesData";
import { VIEW_FIXTURE } from "./fixtures";

const TODAY = VIEW_FIXTURE.today;

describe("eventsByDay", () => {
  it("lists today and the next 7 days, all-day first", () => {
    const days = eventsByDay(VIEW_FIXTURE.calendar!.events, TODAY);
    expect(days.map((d) => d.day)).toEqual([
      "2026-10-31",
      "2026-11-03",
      "2026-11-05",
    ]);
    expect(days[0].events.map((e) => e.subject)).toEqual([
      "Harvest festival",
      "Team standup",
    ]);
  });

  it("is empty with no events", () => {
    expect(eventsByDay([], TODAY)).toEqual([]);
  });
});

describe("labCards", () => {
  it("groups by marker, flagged first, and leaves out held markers", () => {
    const cards = labCards(VIEW_FIXTURE.health);
    // Estradiol is held until a draw after 2026-10-01 and none came yet.
    expect(cards.map((c) => c.marker)).toEqual(["Hemoglobin", "Ferritin"]);
    expect(cards[0].latest).toMatchObject({ v: 17.6, flag: "H" });
    expect(cards[0].range).toBe("13.2–17.1");
    expect(cards[0].lo).toBe(13.2);
    expect(cards[0].hi).toBe(17.1);
    // A blank value is skipped, not plotted as zero.
    expect(cards[1].points).toHaveLength(1);
  });

  it("shows held markers again once a newer draw lands", () => {
    const health = {
      ...VIEW_FIXTURE.health,
      draws: [
        ...VIEW_FIXTURE.health.draws,
        { date: "2026-10-15", lab: "Lab A", approx: false },
      ],
    };
    expect(labCards(health).map((c) => c.marker)).toContain("Estradiol");
  });

  it("reads one-sided ranges", () => {
    const health = {
      ...VIEW_FIXTURE.health,
      hold: undefined,
    };
    const e2 = labCards(health).find((c) => c.marker === "Estradiol");
    expect(e2?.lo).toBeNull();
    expect(e2?.hi).toBe(39);
  });
});

describe("movementBests", () => {
  it("computes the best set, est. 1RM and rep maxes", () => {
    const moves = movementBests(VIEW_FIXTURE.training.lifts);
    const squat = moves.find((m) => m.name === "Back squat");
    // 225 × 5 → 225 × (1 + 5/30) = 262.5; 255 × 1 → 255.
    expect(squat?.est1rm).toBe(263);
    expect(squat?.heaviest).toMatchObject({ weight: 255, reps: 1 });
    expect(squat?.repMax.map((r) => [r.reps, r.weight])).toEqual([
      [1, 255],
      [5, 225],
    ]);
  });

  it("gives bodyweight moves their most reps and inch moves no 1RM", () => {
    const moves = movementBests(VIEW_FIXTURE.training.lifts);
    const pullup = moves.find((m) => m.name === "Pull-up");
    expect(pullup?.bodyweight).toBe(true);
    expect(pullup?.maxReps).toBe(12);
    expect(pullup?.est1rm).toBeNull();
    const box = moves.find((m) => m.name === "Box jump");
    expect(box?.est1rm).toBeNull();
  });

  it("sorts by most recently done", () => {
    expect(
      movementBests(VIEW_FIXTURE.training.lifts).map((m) => m.name)
    ).toEqual(["Box jump", "Pull-up", "Back squat"]);
  });
});

describe("golfSummary", () => {
  it("averages counted rounds per nine and skips scrambles", () => {
    const s = golfSummary(VIEW_FIXTURE.golf);
    // 46 (9 holes) and 96 (18 holes → 48 per nine).
    expect(s.counted).toBe(2);
    expect(s.avgPerNine).toBe(47);
    expect(s.best?.date).toBe("2026-10-12");
    expect(s.rounds.map((r) => r.date)).toEqual([
      "2026-10-25",
      "2026-10-19",
      "2026-10-12",
    ]);
  });

  it("has no average with no rounds", () => {
    expect(golfSummary([]).avgPerNine).toBeNull();
  });
});

describe("people", () => {
  const [alex, sam, morgan, pat, plumber] = VIEW_FIXTURE.people;

  it("groups like the Mac viewer", () => {
    expect(personGroup(alex)).toBe("Family");
    expect(personGroup(sam)).toBe("Work");
    expect(personGroup(morgan)).toBe("Friends");
    expect(personGroup(pat)).toBe("Family");
    expect(personGroup(plumber)).toBe("Others");
  });

  it("works out age and signs", () => {
    expect(ageOn(alex.birth, TODAY)).toBe(36);
    expect(ageOn({ y: 1990, m: 11, d: 3, unsure: false }, TODAY)).toBe(35);
    expect(ageOn(morgan.birth, TODAY)).toBeNull();
    expect(sunSign(6, 16)).toBe("Gemini");
    expect(sunSign(12, 25)).toBe("Capricorn");
    expect(chineseZodiac({ y: 1990, m: 6, d: 16, unsure: false })).toBe(
      "Metal Horse"
    );
    // Too close to Lunar New Year to call.
    expect(chineseZodiac({ y: 1990, m: 2, d: 1, unsure: false })).toBeNull();
  });

  it("lists birthday, age, next birthday and signs", () => {
    expect(personFacts(alex, TODAY)).toEqual([
      ["Birthday", "Jun 16, 1990"],
      ["Age", "36"],
      ["Next", "in 228 days"],
      ["Signs", "Gemini · Metal Horse"],
    ]);
  });

  it("marks an unsure birthday and skips the age with no year", () => {
    expect(personFacts(morgan, TODAY)).toEqual([
      ["Birthday", "Nov 3 (unconfirmed)"],
      ["Next", "in 3 days"],
      ["Signs", "Scorpio"],
    ]);
  });

  it("shows the died line and Born, not a countdown", () => {
    expect(personFacts(pat, TODAY)).toEqual([
      ["", "Died 2010-05-01"],
      ["Born", "Feb 10, 1930"],
      ["Signs", "Aquarius · Metal Horse"],
    ]);
  });

  it("has nothing to say with no birthday", () => {
    expect(personFacts(sam, TODAY)).toEqual([]);
  });
});
