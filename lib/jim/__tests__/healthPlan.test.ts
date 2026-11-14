import {
  dueOn,
  keyMarkerRank,
  mondayOf,
  nextShot,
  otherSide,
  plans,
  shotsNewestFirst,
  shotTime,
  sideOf,
  weekGrid,
  weekday,
  weeklyTotals,
} from "@/lib/jim/healthPlan";
import type { DosePlan, Injection } from "@/lib/jim/view";

const MWF: DosePlan = {
  from: "2026-10-26",
  days: [0, 2, 4],
  label: "Mon, Wed, Fri",
  ml: 0.5,
  mg: 100,
  note: "",
};
const TAPER: DosePlan = {
  from: "2026-12-04",
  days: [],
  label: "Twice a week",
  ml: 0.55,
  mg: 110,
  note: "",
};

function shot(date: string, site = "", mg = 100): Injection {
  return { date, time: "", mg, ml: "0.5", site, note: "" };
}

describe("sides", () => {
  it("reads left and right from the site, nothing else", () => {
    expect(sideOf("Left glute")).toBe("left");
    expect(sideOf("right glute")).toBe("right");
    expect(sideOf("")).toBeNull();
    expect(sideOf(undefined)).toBeNull();
    expect(sideOf("abdomen")).toBeNull();
    expect(otherSide("left")).toBe("right");
    expect(otherSide(null)).toBeNull();
  });
});

describe("dates", () => {
  it("counts weekdays from Monday and finds the Monday", () => {
    expect(weekday("2026-11-02")).toBe(0); // Monday
    expect(weekday("2026-11-08")).toBe(6); // Sunday
    expect(mondayOf("2026-11-08")).toBe("2026-11-02");
    expect(mondayOf("2026-11-02")).toBe("2026-11-02");
  });
  it("trims the tilde from a shot time", () => {
    expect(shotTime("~5:42 PM")).toBe("5:42 PM");
    expect(shotTime("~")).toBe("");
    expect(shotTime(undefined)).toBe("");
  });
});

describe("plans", () => {
  it("picks the plan in force and the one that takes over", () => {
    expect(plans([MWF, TAPER], "2026-11-02")).toEqual({
      current: MWF,
      upcoming: TAPER,
    });
    expect(plans([MWF, TAPER], "2026-12-04").current).toBe(TAPER);
    expect(plans([MWF], "2026-10-01")).toEqual({
      current: null,
      upcoming: MWF,
    });
    expect(plans(undefined, "2026-11-02")).toEqual({
      current: null,
      upcoming: null,
    });
  });
  it("knows which days are due", () => {
    expect(dueOn([MWF], "2026-11-02")).toBe(true); // Monday
    expect(dueOn([MWF], "2026-11-03")).toBe(false);
    expect(dueOn([MWF], "2026-10-23")).toBe(false); // before the plan
    expect(dueOn([MWF, TAPER], "2026-12-07")).toBe(false); // no fixed days
  });
});

describe("nextShot", () => {
  it("is the next scheduled day after the last shot", () => {
    expect(nextShot([MWF], "2026-11-02", "2026-11-02")).toEqual({
      date: "2026-11-04",
      state: "upcoming",
      mg: 100,
      ml: 0.5,
    });
  });
  it("is due today when today is the next scheduled day", () => {
    expect(nextShot([MWF], "2026-10-30", "2026-11-02")?.state).toBe("today");
  });
  it("is overdue when a scheduled day passed with no shot", () => {
    const n = nextShot([MWF], "2026-10-30", "2026-11-03");
    expect(n?.date).toBe("2026-11-02");
    expect(n?.state).toBe("overdue");
  });
  it("follows a shifted shot rather than the fixed days", () => {
    // Wednesday's shot taken on Thursday: the next one is Friday.
    expect(nextShot([MWF], "2026-11-05", "2026-11-05")?.date).toBe(
      "2026-11-06"
    );
  });
  it("gives nothing without a schedule or fixed days", () => {
    expect(nextShot([], "2026-11-02", "2026-11-02")).toBeNull();
    expect(nextShot([MWF, TAPER], "2026-12-05", "2026-12-06")).toBeNull();
  });
  it("starts from today when nothing is logged", () => {
    expect(nextShot([MWF], null, "2026-11-03")?.date).toBe("2026-11-04");
  });
});

describe("shotsNewestFirst", () => {
  it("sorts by date and keeps the later same-day shot first", () => {
    const a = shot("2026-10-21");
    const b = shot("2026-10-23");
    const c = { ...shot("2026-10-23"), note: "second" };
    expect(shotsNewestFirst([a, b, c])).toEqual([b, c, a]);
  });
});

describe("weekGrid", () => {
  it("lays out this week and next, with shots and due days", () => {
    const rows = weekGrid(
      {
        injections: [shot("2026-11-02", "Left glute")],
        schedule: [MWF, TAPER],
      },
      "2026-11-03"
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].map((d) => d.date)).toEqual([
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
      "2026-11-08",
    ]);
    expect(rows[0].map((d) => d.due)).toEqual([
      true,
      false,
      true,
      false,
      true,
      false,
      false,
    ]);
    expect(rows[0][0].shots).toHaveLength(1);
    expect(rows[0][1].today).toBe(true);
    expect(rows[1][0].date).toBe("2026-11-09");
  });
});

describe("weeklyTotals", () => {
  it("adds the milligrams in each Monday-to-Sunday week", () => {
    const t = weeklyTotals(
      [
        shot("2026-10-26", "", 100),
        shot("2026-10-28", "", 100),
        shot("2026-10-30", "", 100),
        shot("2026-11-02", "", 100),
      ],
      "2026-11-02",
      3
    );
    expect(t.map((w) => [w.monday, w.mg, w.shots, w.partial])).toEqual([
      ["2026-10-19", 0, 0, false],
      ["2026-10-26", 300, 3, false],
      ["2026-11-02", 100, 1, true],
    ]);
  });
});

describe("keyMarkerRank", () => {
  it("ranks the markers worth a chart and leaves the rest", () => {
    expect(keyMarkerRank("Total testosterone (ng/dL)")).toBe(0);
    expect(keyMarkerRank("Free testosterone, direct (pg/mL)")).toBe(1);
    expect(keyMarkerRank("Estradiol (pg/mL)")).toBe(2);
    expect(keyMarkerRank("Hematocrit (%)")).toBe(3);
    expect(keyMarkerRank("Hemoglobin (g/dL)")).toBe(4);
    expect(keyMarkerRank("Ferritin (ng/mL)")).toBe(5);
    expect(keyMarkerRank("Hemoglobin A1c (%)")).toBe(-1);
    expect(keyMarkerRank("PSA (ng/mL)")).toBe(-1);
  });
});
