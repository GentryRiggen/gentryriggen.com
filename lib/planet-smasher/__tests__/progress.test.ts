import {
  PROGRESS_KEY,
  freshProgress,
  freshStats,
  loadProgress,
  saveProgress,
} from "../progress";

function fakeStorage(init: Record<string, string> = {}): Storage {
  const data = { ...init };
  return {
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  } as unknown as Storage;
}

describe("progress", () => {
  it("loads a 1.0 save unchanged", () => {
    const p = {
      points: 4000,
      endingsSeen: ["shatter", "molten", "swallowed"],
      planetId: "mars",
      toolId: "megaBomb",
    };
    const s = fakeStorage({ [PROGRESS_KEY]: JSON.stringify(p) });
    expect(loadProgress(s)).toEqual({
      ...p,
      stats: freshStats(),
      trophies: [],
      // A save from before 1.3 keeps what the 1.2 path had open.
      owned: [
        "tool:meteorShower",
        "tool:megaBomb",
        "tool:nuke",
        "tool:supervolcano",
        "tool:earthquake",
        "tool:alienLaser",
        "planet:mars",
        "tool:freezeRay",
        "tool:moonRam",
      ],
    });
  });

  it("keeps the consumed ending", () => {
    const s = fakeStorage();
    const p = { ...freshProgress(), endingsSeen: ["consumed" as const] };
    saveProgress(p, s);
    expect(loadProgress(s).endingsSeen).toEqual(["consumed"]);
  });

  it("round-trips", () => {
    const s = fakeStorage();
    const p = {
      points: 321,
      endingsSeen: ["molten" as const],
      planetId: "mars" as const,
      toolId: "nuke" as const,
      stats: freshStats(),
      trophies: [],
      owned: ["tool:meteorShower"],
    };
    saveProgress(p, s);
    expect(loadProgress(s)).toEqual(p);
  });

  it("falls back to fresh on bad data or a throwing storage", () => {
    expect(loadProgress(fakeStorage({ [PROGRESS_KEY]: "{bad" }))).toEqual(
      freshProgress()
    );
    const throwing = {
      getItem: () => {
        throw new Error("no");
      },
    } as unknown as Storage;
    expect(loadProgress(throwing)).toEqual(freshProgress());
  });

  it("never throws on save", () => {
    const throwing = {
      setItem: () => {
        throw new Error("full");
      },
    } as unknown as Storage;
    expect(() => saveProgress(freshProgress(), throwing)).not.toThrow();
  });

  it("falls back on unknown ids", () => {
    const s = fakeStorage({
      [PROGRESS_KEY]: JSON.stringify({
        points: 50,
        endingsSeen: ["frozen", "bogus"],
        planetId: "pluto",
        toolId: "laserCat",
      }),
    });
    expect(loadProgress(s)).toEqual({
      points: 50,
      endingsSeen: ["frozen"],
      planetId: "earth",
      toolId: "asteroid",
      stats: freshStats(),
      trophies: [],
      owned: ["tool:meteorShower"],
    });
  });

  it("keeps a saved owned list and drops junk in it", () => {
    const s = fakeStorage({
      [PROGRESS_KEY]: JSON.stringify({
        points: 9000,
        owned: ["tool:nuke", 7, "planet:mars"],
      }),
    });
    expect(loadProgress(s).owned).toEqual(["tool:nuke", "planet:mars"]);
  });
});
