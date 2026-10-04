import {
  fuzzyFilter,
  fuzzyScore,
  isSubsequence,
  isWithinOneEdit,
  type SearchField,
} from "../fuzzy";

interface Item {
  name: string;
  description: string;
}

const ITEMS: Item[] = [
  { name: "Funnel", description: "Lets out the smoke" },
  { name: "Lifeboat", description: "Saves the passengers" },
  { name: "Collapsible lifeboat", description: "Folds flat" },
  { name: "Mast", description: "Holds a flag up high" },
  { name: "Bridge", description: "Where the captain steers" },
];

const fields = (item: Item): SearchField[] => [
  { text: item.name, weight: 1, allowSubsequence: true },
  { text: item.description, weight: 0.4 },
];
const names = (query: string) =>
  fuzzyFilter(query, ITEMS, fields).map((i) => i.name);

describe("isWithinOneEdit", () => {
  it.each([
    ["funnel", "funnel"],
    ["funel", "funnel"],
    ["funnnel", "funnel"],
    ["fennel", "funnel"],
    ["fnunel", "funnel"],
  ])("accepts %s ~ %s", (a, b) => {
    expect(isWithinOneEdit(a, b)).toBe(true);
  });

  it.each([
    ["fnel", "funnel"],
    ["boat", "funnel"],
    ["fnuxel", "funnel"],
  ])("rejects %s ~ %s", (a, b) => {
    expect(isWithinOneEdit(a, b)).toBe(false);
  });
});

describe("isSubsequence", () => {
  it("matches letters in order", () => {
    expect(isSubsequence("fnl", "funnel")).toBe(true);
    expect(isSubsequence("lnf", "funnel")).toBe(false);
  });
});

describe("fuzzyFilter", () => {
  it("returns everything for an empty or blank query", () => {
    expect(names("")).toHaveLength(ITEMS.length);
    expect(names("   ")).toHaveLength(ITEMS.length);
  });

  it("is case-insensitive", () => {
    expect(names("FUNNEL")).toEqual(["Funnel"]);
  });

  it("matches subsequences", () => {
    expect(names("fnl")).toEqual(["Funnel"]);
    expect(names("lboat")).toContain("Lifeboat");
  });

  it("forgives a single typo", () => {
    expect(names("funel")).toEqual(["Funnel"]);
    expect(names("lifebot")).toEqual(["Lifeboat", "Collapsible lifeboat"]);
    expect(names("brigde")).toEqual(["Bridge"]);
  });

  it("does not forgive typos in very short words", () => {
    expect(names("maz")).toEqual([]);
    expect(names("mas")).toEqual(["Mast"]);
  });

  it("searches descriptions", () => {
    expect(names("captain")).toEqual(["Bridge"]);
  });

  it("ranks exact before prefix before substring", () => {
    const items = ["Sailboat", "Boat", "Boathouse"].map((name) => ({
      name,
      description: "",
    }));
    const result = fuzzyFilter("boat", items, fields).map((i) => i.name);
    expect(result).toEqual(["Boat", "Boathouse", "Sailboat"]);
  });

  it("ranks name matches above description matches", () => {
    const items: Item[] = [
      { name: "Anchor", description: "Holds the mast steady" },
      { name: "Mast", description: "" },
    ];
    expect(fuzzyFilter("mast", items, fields).map((i) => i.name)).toEqual([
      "Mast",
      "Anchor",
    ]);
  });

  it("requires every word of a multi-word query", () => {
    expect(names("collapsible boat")).toEqual(["Collapsible lifeboat"]);
    expect(names("funnel boat")).toEqual([]);
  });

  it("ignores word order and punctuation", () => {
    expect(names("lifeboat, collapsible")).toEqual(["Collapsible lifeboat"]);
  });

  it("keeps original order for ties", () => {
    expect(names("lifeboat")).toEqual(["Lifeboat", "Collapsible lifeboat"]);
  });
});

describe("fuzzyScore", () => {
  it("is null when nothing matches and 0 for an empty query", () => {
    expect(fuzzyScore("zzz", fields(ITEMS[0]))).toBeNull();
    expect(fuzzyScore("", fields(ITEMS[0]))).toBe(0);
  });
});
