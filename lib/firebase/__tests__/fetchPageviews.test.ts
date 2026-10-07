import { FIRESTORE_MAX_LIMIT, MAX_DOCS, fetchPageviews } from "../client";

// Read lazily: the firebase/firestore mock below only loads on first call.
const mockLimit = jest.fn((n: number) => ({ n }));

const good = {
  site: "home",
  path: "/",
  ref: "",
  device: "desktop",
  browser: "Chrome",
  os: "macOS",
  screen: "1440+",
  tz: "UTC",
  vid: "0123456789abcdef",
};

jest.mock("firebase/app", () => ({
  getApps: () => [{}],
  initializeApp: () => ({}),
}));

jest.mock("firebase/firestore", () => {
  class Timestamp {
    constructor(private ms: number) {}
    static fromMillis(ms: number) {
      return new Timestamp(ms);
    }
    toDate() {
      return new Date(this.ms);
    }
  }
  const withTs = (data: object) => ({ data: () => data });
  return {
    Timestamp,
    getFirestore: () => ({}),
    collection: () => ({}),
    where: () => ({}),
    orderBy: () => ({}),
    limit: (n: number) => mockLimit(n),
    query: () => ({}),
    getDocs: async () => {
      const docs = [
        withTs({ ...good, ts: new Timestamp(1000) }),
        withTs({ ...good, ts: undefined }),
        withTs({ ...good, ts: new Timestamp(2000), path: 42 }),
      ];
      return { docs, size: docs.length };
    },
  };
});

it("returns only well-formed docs and computes truncated from the raw size", async () => {
  const result = await fetchPageviews(0, 3);
  expect(result.docs).toHaveLength(1);
  expect(result.docs[0].ts).toEqual(new Date(1000));
  expect(result.docs[0].path).toBe("/");
  expect(result.truncated).toBe(true);
});

describe("query limit", () => {
  it("never asks Firestore for more than its 10,000 document maximum", async () => {
    mockLimit.mockClear();
    await fetchPageviews(0);
    expect(MAX_DOCS).toBeLessThanOrEqual(FIRESTORE_MAX_LIMIT);
    const [requested] = mockLimit.mock.calls[0] as unknown as [number];
    expect(requested).toBeLessThanOrEqual(FIRESTORE_MAX_LIMIT);
  });
});
