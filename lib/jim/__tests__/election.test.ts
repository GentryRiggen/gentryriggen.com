import { electionAt, normalizeElections } from "@/lib/jim/election";

const RACE = {
  name: "Ohio Senate",
  kind: "senate",
  a: "Brown",
  aParty: "D",
  b: "Husted",
  bParty: "R",
  seat: "R",
};

const RAW = {
  elections: [
    {
      slug: "night",
      title: "Night",
      date: "2026-11-03",
      races: {
        oh: RACE,
        co: { ...RACE, name: "Colorado", seat: "D", mine: true },
        bad: { name: "No parties" },
      },
      updates: [
        {
          at: "2026-11-03T20:00:00-05:00",
          asked: "Latest?",
          headline: "Early",
          senate: { d: 40, r: 30, uncalled: 30, flips: 0 },
          results: {
            oh: { a: 60, b: 35, counted: 20 },
            co: { a: 0, b: 0, counted: 0 },
            bad: { a: 1, b: 2, counted: 3 },
          },
        },
        { at: "nope", headline: "Dropped" },
        {
          at: "2026-11-03T21:00:00-05:00",
          headline: "Later",
          results: { oh: { a: 49, b: 47, counted: 80, called: "a" } },
        },
      ],
    },
    { slug: "empty", races: {}, updates: [] },
    "junk",
  ],
};

describe("normalizeElections", () => {
  it("keeps what is well formed and drops the rest", () => {
    const data = normalizeElections(RAW)!;
    expect(data.elections.map((e) => e.slug)).toEqual(["night"]);
    const [night] = data.elections;
    expect(night.races.map((r) => r.id)).toEqual(["oh", "co"]);
    expect(night.updates.map((u) => u.headline)).toEqual(["Early", "Later"]);
    expect(Object.keys(night.updates[0].results)).toEqual(["oh", "co"]);
  });

  it("refuses anything without a list of elections", () => {
    expect(normalizeElections({})).toBeNull();
    expect(normalizeElections([])).toBeNull();
    expect(normalizeElections({ elections: [] })).toEqual({ elections: [] });
  });

  it("passes stale through", () => {
    expect(normalizeElections({ elections: [], stale: true })?.stale).toBe(
      true
    );
  });
});

describe("electionAt", () => {
  const night = normalizeElections(RAW)!.elections[0];

  it("shows only what was known at that update", () => {
    const at = electionAt(night, 0);
    expect(at.update.headline).toBe("Early");
    expect(at.races.find((r) => r.race.id === "oh")).toMatchObject({
      now: { a: 60, called: null },
      trail: [25],
      flip: false,
    });
  });

  it("carries chambers and races forward and marks a flip", () => {
    const at = electionAt(night, 1);
    expect(at.senate?.d).toBe(40);
    expect(at.races.find((r) => r.race.id === "oh")).toMatchObject({
      trail: [25, 2],
      flip: true,
    });
    expect(at.races.find((r) => r.race.id === "co")?.trail).toEqual([]);
  });

  it("clamps the index", () => {
    expect(electionAt(night, 99).update.headline).toBe("Later");
    expect(electionAt(night, -1).update.headline).toBe("Early");
  });
});
