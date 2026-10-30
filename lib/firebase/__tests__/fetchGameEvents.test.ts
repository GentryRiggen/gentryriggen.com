import { fetchGameEvents } from "../client";

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
  }
  const snap = (data: object) => ({ data: () => data });
  return {
    Timestamp,
    getFirestore: () => ({}),
    collection: () => ({}),
    where: () => ({}),
    orderBy: () => ({}),
    limit: () => ({}),
    query: () => ({}),
    getDocs: async () => {
      const good = {
        site: "plane-builder",
        name: "world_unlocked",
        props: { world: "canyon" },
        day: "2026-10-30",
      };
      const docs = [
        snap(good),
        snap({ ...good, props: { world: "<script>" } }),
        snap({ ...good, site: "ship-builder" }),
        snap({ nothing: true }),
      ];
      return { docs, size: docs.length };
    },
  };
});

it("keeps valid events and skips malformed or doctored docs", async () => {
  const result = await fetchGameEvents(0);
  expect(result.events).toHaveLength(1);
  expect(result.events[0].props).toEqual({ world: "canyon" });
  expect(result.truncated).toBe(false);
});

it("reports truncation when the cap is hit", async () => {
  expect((await fetchGameEvents(0, 4)).truncated).toBe(true);
});
