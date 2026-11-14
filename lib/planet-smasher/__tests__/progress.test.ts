import {
  PROGRESS_KEY,
  freshProgress,
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
  it("round-trips", () => {
    const s = fakeStorage();
    const p = {
      points: 321,
      endingsSeen: ["molten" as const],
      planetId: "mars" as const,
      toolId: "nuke" as const,
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
    });
  });
});
