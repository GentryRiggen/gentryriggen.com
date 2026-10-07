import { getVisitorId, utcDay } from "../visitor";
import { isExcluded, setExcluded } from "../exclude";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
}

describe("getVisitorId", () => {
  const day1 = new Date("2026-10-07T01:00:00Z");
  const day1Late = new Date("2026-10-07T23:59:00Z");
  const day2 = new Date("2026-10-08T00:01:00Z");

  it("is stable within a UTC day", () => {
    const storage = fakeStorage();
    const a = getVisitorId(storage, day1);
    expect(getVisitorId(storage, day1Late)).toBe(a);
  });

  it("rotates on the next UTC day", () => {
    const storage = fakeStorage();
    const a = getVisitorId(storage, day1);
    expect(getVisitorId(storage, day2)).not.toBe(a);
  });

  it("returns a usable id when storage is missing or throws", () => {
    expect(getVisitorId(null, day1).length).toBeGreaterThanOrEqual(8);
    const broken = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    expect(getVisitorId(broken, day1).length).toBeGreaterThanOrEqual(8);
  });

  it("ignores corrupt stored values", () => {
    const storage = fakeStorage({ "analytics-vid": "{not json" });
    expect(getVisitorId(storage, day1).length).toBeGreaterThanOrEqual(8);
  });
});

describe("utcDay", () => {
  it("formats as YYYY-MM-DD in UTC", () => {
    expect(utcDay(new Date("2026-10-07T23:59:59Z"))).toBe("2026-10-07");
  });
});

describe("exclude flag", () => {
  it("round-trips", () => {
    const storage = fakeStorage();
    expect(isExcluded(storage)).toBe(false);
    setExcluded(storage);
    expect(isExcluded(storage)).toBe(true);
  });

  it("is false when storage is unavailable", () => {
    expect(isExcluded(null)).toBe(false);
  });
});
