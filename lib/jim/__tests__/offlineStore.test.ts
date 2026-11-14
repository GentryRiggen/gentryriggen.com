import {
  clearAll,
  IDB_TIMEOUT_MS,
  loadView,
  saveView,
  setOfflineBackend,
  viewKey,
  type KeyValueStore,
} from "../offlineStore";
import { VIEW_FIXTURE } from "./fixtures";

/** A Map standing in for IndexedDB. */
function memoryStore(): KeyValueStore & { map: Map<string, unknown> } {
  const map = new Map<string, unknown>();
  return {
    map,
    get: async (key) => map.get(key),
    set: async (key, value) => {
      map.set(key, JSON.parse(JSON.stringify(value)));
    },
    clear: async () => map.clear(),
  };
}

afterEach(() => setOfflineBackend(null));

it("keeps the last payload per user and reads it back with its time", async () => {
  const store = memoryStore();
  setOfflineBackend(store);
  jest.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
  await saveView("uid-a", VIEW_FIXTURE);
  jest.restoreAllMocks();

  expect([...store.map.keys()]).toEqual([viewKey("uid-a")]);
  expect(viewKey("uid-a")).toBe("view:uid-a");
  const saved = await loadView("uid-a");
  expect(saved?.savedAt).toBe(1_700_000_000_000);
  expect(saved?.payload.today).toBe(VIEW_FIXTURE.today);
  expect(saved?.payload.todos).toHaveLength(VIEW_FIXTURE.todos.length);
  // Another user on the same device sees nothing.
  expect(await loadView("uid-b")).toBeNull();
});

it("clearAll forgets every user's payload", async () => {
  const store = memoryStore();
  setOfflineBackend(store);
  await saveView("uid-a", VIEW_FIXTURE);
  await saveView("uid-b", VIEW_FIXTURE);
  await clearAll();
  expect(store.map.size).toBe(0);
  expect(await loadView("uid-a")).toBeNull();
});

it("ignores an entry that isn't a saved view", async () => {
  const store = memoryStore();
  setOfflineBackend(store);
  store.map.set(viewKey("uid-a"), { payload: { nope: 1 }, savedAt: 1 });
  expect(await loadView("uid-a")).toBeNull();
  store.map.set(viewKey("uid-a"), "junk");
  expect(await loadView("uid-a")).toBeNull();
});

it("never throws when storage is blocked", async () => {
  const broken: KeyValueStore = {
    get: async () => {
      throw new Error("blocked");
    },
    set: async () => {
      throw new Error("blocked");
    },
    clear: async () => {
      throw new Error("blocked");
    },
  };
  setOfflineBackend(broken);
  await expect(saveView("uid-a", VIEW_FIXTURE)).resolves.toBeUndefined();
  await expect(loadView("uid-a")).resolves.toBeNull();
  await expect(clearAll()).resolves.toBeUndefined();
});

it("does nothing without IndexedDB (jsdom)", async () => {
  expect(typeof indexedDB).toBe("undefined");
  await saveView("uid-a", VIEW_FIXTURE);
  await expect(loadView("uid-a")).resolves.toBeNull();
});

describe("a stuck IndexedDB (iOS WebKit)", () => {
  const original = (globalThis as { indexedDB?: unknown }).indexedDB;
  afterEach(() => {
    jest.useRealTimers();
    (globalThis as { indexedDB?: unknown }).indexedDB = original;
    setOfflineBackend(null);
  });

  it("gives up after IDB_TIMEOUT_MS instead of waiting forever", async () => {
    jest.useFakeTimers();
    setOfflineBackend(null);
    const open = jest.fn(() => ({}) as IDBOpenDBRequest); // never fires
    (globalThis as { indexedDB?: unknown }).indexedDB = { open };
    const result = loadView("u1");
    await jest.advanceTimersByTimeAsync(IDB_TIMEOUT_MS);
    await expect(result).resolves.toBeNull();
    // The stuck open is dropped: the next call opens afresh.
    const again = loadView("u1");
    await jest.advanceTimersByTimeAsync(IDB_TIMEOUT_MS);
    await expect(again).resolves.toBeNull();
    expect(open).toHaveBeenCalledTimes(2);
  });
});
