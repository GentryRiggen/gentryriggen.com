import { fetchPageviews } from "../client";

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
    limit: () => ({}),
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
