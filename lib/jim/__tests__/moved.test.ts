import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

/**
 * The old address's stub (public/jim-moved.js) and the kill-switch worker
 * (public/jim-sw-kill.js). Both are plain scripts, loaded into a sandbox the
 * way the jim-sw.js tests load the real worker.
 */

const MOVED_SOURCE = readFileSync(
  path.join(process.cwd(), "public/jim-moved.js"),
  "utf8"
);
const KILL_SOURCE = readFileSync(
  path.join(process.cwd(), "public/jim-sw-kill.js"),
  "utf8"
);

const OWNER_UID = "nmt3n9sdfCX2NfzVlTdyXsWzHqm2";
const OLD = "https://old.example.test";

interface Moved {
  wipeJim: (env: Record<string, unknown>) => Promise<void>;
  target: (location: { pathname: string; search?: string }) => string;
}

/** Loads the stub as a module (exports only, nothing runs). */
function loadMoved(): Moved {
  const context: Record<string, unknown> = {
    module: {},
    setTimeout,
    clearTimeout,
    Promise,
    JSON,
  };
  vm.runInNewContext(MOVED_SOURCE, context);
  return context.__jimMoved as Moved;
}

/** A Storage-like map. */
function fakeStorage(entries: Record<string, string>) {
  const map = new Map(Object.entries(entries));
  return {
    map,
    get length() {
      return map.size;
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

interface AuthRecord {
  fbase_key: string;
  value: { uid: string; isAnonymous?: boolean };
}

/** Just enough IndexedDB for the stub: delete a database, walk one store. */
function fakeIndexedDB(records: AuthRecord[], { hangDelete = false } = {}) {
  const store = new Map(records.map((r) => [r.fbase_key, r]));
  const deleted: string[] = [];
  const later = (fn: () => void) => setTimeout(fn, 0);
  const idb = {
    deleteDatabase: (name: string) => {
      const req: Record<string, (() => void) | undefined> = {};
      if (!hangDelete) {
        later(() => {
          deleted.push(name);
          req.onsuccess?.();
        });
      }
      return req;
    },
    open: (name: string) => {
      const req: Record<string, unknown> = {};
      later(() => {
        if (name !== "firebaseLocalStorageDb") {
          (req.onerror as () => void)?.();
          return;
        }
        const tx: Record<string, unknown> = {};
        const db = {
          objectStoreNames: {
            contains: (s: string) => s === "firebaseLocalStorage",
          },
          close: jest.fn(),
          transaction: () => {
            tx.objectStore = () => ({
              openCursor: () => {
                const cursorReq: Record<string, unknown> = {};
                const keys = [...store.keys()];
                let i = 0;
                const step = () =>
                  later(() => {
                    const key = keys[i];
                    cursorReq.result =
                      key === undefined
                        ? null
                        : {
                            value: store.get(key),
                            delete: () => store.delete(key),
                            continue: () => {
                              i += 1;
                              step();
                            },
                          };
                    (cursorReq.onsuccess as () => void)?.();
                    if (key === undefined) {
                      later(() => (tx.oncomplete as () => void)?.());
                    }
                  });
                step();
                return cursorReq;
              },
            });
            return tx;
          },
        };
        req.result = db;
        (req.onsuccess as () => void)?.();
      });
      return req;
    },
  };
  return { idb, store, deleted };
}

function fakeCaches(names: string[], { broken = false } = {}) {
  const set = new Set(names);
  return {
    set,
    keys: async () => {
      if (broken) throw new Error("SecurityError");
      return [...set];
    },
    delete: async (name: string) => set.delete(name),
  };
}

function fakeServiceWorker(scopes: string[]) {
  const regs = scopes.map((scope) => ({
    scope,
    unregister: jest.fn(async () => true),
  }));
  return { regs, getRegistrations: async () => regs };
}

function makeEnv(overrides: Record<string, unknown> = {}) {
  const local = fakeStorage({
    "jim:chat:x": "[]",
    "jim:lock:x": "{}",
    "jim-draft": "hi",
    theme: "dark",
    [`firebase:authUser:key:[DEFAULT]`]: JSON.stringify({ uid: OWNER_UID }),
  });
  const session = fakeStorage({ "jim:draft:x": "half", "other:x": "1" });
  const db = fakeIndexedDB([
    {
      fbase_key: "firebase:authUser:key:[DEFAULT]",
      value: { uid: OWNER_UID },
    },
    {
      fbase_key: "firebase:authUser:key:other",
      value: { uid: "anon-player-1", isAnonymous: true },
    },
  ]);
  const caches = fakeCaches(["jim-shell-v1", "ship-builder-v3"]);
  const sw = fakeServiceWorker([`${OLD}/jim`, `${OLD}/ship-builder`]);
  const env = {
    localStorage: local,
    sessionStorage: session,
    indexedDB: db.idb,
    caches,
    serviceWorker: sw,
    ...overrides,
  };
  return { env, local, session, db, caches, sw };
}

describe("wipeJim", () => {
  it("removes Jim's storage keys and keeps everything else", async () => {
    const { wipeJim } = loadMoved();
    const { env, local, session } = makeEnv();
    await wipeJim(env);
    expect([...local.map.keys()]).toEqual(["theme"]);
    expect([...session.map.keys()]).toEqual(["other:x"]);
  });

  it("keeps someone else's sign-in in localStorage", async () => {
    const { wipeJim } = loadMoved();
    const local = fakeStorage({
      "firebase:authUser:key:[DEFAULT]": JSON.stringify({ uid: "anon-1" }),
      "firebase:authUser:key:broken": "{not json",
    });
    await wipeJim(makeEnv({ localStorage: local }).env);
    expect(local.map.size).toBe(2);
  });

  it("deletes Jim's database and only the owner's sign-in record", async () => {
    const { wipeJim } = loadMoved();
    const { env, db } = makeEnv();
    await wipeJim(env);
    expect(db.deleted).toEqual(["jim"]);
    expect([...db.store.keys()]).toEqual(["firebase:authUser:key:other"]);
  });

  it("deletes Jim's caches and unregisters only Jim's worker", async () => {
    const { wipeJim } = loadMoved();
    const { env, caches, sw } = makeEnv();
    await wipeJim(env);
    expect([...caches.set]).toEqual(["ship-builder-v3"]);
    expect(sw.regs[0].unregister).toHaveBeenCalled();
    expect(sw.regs[1].unregister).not.toHaveBeenCalled();
  });

  it("keeps going when a step fails or storage is missing", async () => {
    const { wipeJim } = loadMoved();
    const { env, local, sw } = makeEnv({
      caches: fakeCaches(["jim-shell-v1"], { broken: true }),
      sessionStorage: undefined,
      indexedDB: undefined,
    });
    await wipeJim(env);
    expect(local.map.has("jim:chat:x")).toBe(false);
    expect(sw.regs[0].unregister).toHaveBeenCalled();
  });

  it("gives up on a step that hangs after its cap", async () => {
    const { wipeJim } = loadMoved();
    const hung = fakeIndexedDB([], { hangDelete: true });
    const { env, caches } = makeEnv({ indexedDB: hung.idb, capMs: 20 });
    const started = Date.now();
    await wipeJim(env);
    expect(Date.now() - started).toBeLessThan(1_000);
    expect(caches.set.has("jim-shell-v1")).toBe(false);
  });
});

describe("target", () => {
  const NEW = "https://jim.gentryriggen.com";

  it("keeps Jim's path and query", () => {
    const { target } = loadMoved();
    expect(
      target({ pathname: "/jim/notes/people/sam-okafor", search: "?a=1" })
    ).toBe(`${NEW}/jim/notes/people/sam-okafor?a=1`);
    expect(target({ pathname: "/jim", search: "" })).toBe(`${NEW}/jim`);
  });

  it("sends anything else to /jim", () => {
    const { target } = loadMoved();
    expect(target({ pathname: "/jim.html" })).toBe(`${NEW}/jim`);
    expect(target({ pathname: "/jim-moved.html" })).toBe(`${NEW}/jim`);
    expect(target({ pathname: "/jimmy" })).toBe(`${NEW}/jim`);
    expect(target({ pathname: "//evil.example/jim" })).toBe(`${NEW}/jim`);
  });
});

describe("the page script", () => {
  it("wipes, then replaces the location with the new address", async () => {
    const { env, local } = makeEnv();
    const replace = jest.fn();
    const context: Record<string, unknown> = {
      setTimeout,
      clearTimeout,
      Promise,
      JSON,
      location: { pathname: "/jim/notes", search: "?a=1", replace },
      localStorage: env.localStorage,
      sessionStorage: env.sessionStorage,
      indexedDB: env.indexedDB,
      caches: env.caches,
      navigator: { serviceWorker: env.serviceWorker },
    };
    context.window = context;
    vm.runInNewContext(MOVED_SOURCE, context);
    expect(context.__jimMoved).toBeUndefined();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(local.map.has("jim:chat:x")).toBe(false);
    expect(replace).toHaveBeenCalledWith(
      "https://jim.gentryriggen.com/jim/notes?a=1"
    );
  });
});

describe("the page script as an installed app", () => {
  function run(win: Record<string, unknown>) {
    const { env } = makeEnv();
    const replace = jest.fn();
    const open = { setAttribute: jest.fn(), hidden: false };
    const tab = { hidden: false };
    const app = { hidden: true };
    const elements: Record<string, unknown> = {
      "moved-open": open,
      "moved-tab": tab,
      "moved-app": app,
    };
    const context: Record<string, unknown> = {
      setTimeout,
      clearTimeout,
      Promise,
      JSON,
      location: { pathname: "/jim", search: "", replace },
      localStorage: env.localStorage,
      sessionStorage: env.sessionStorage,
      indexedDB: env.indexedDB,
      caches: env.caches,
      document: {
        readyState: "complete",
        getElementById: (id: string) => elements[id] ?? null,
      },
      navigator: {
        serviceWorker: env.serviceWorker,
        ...(win.navigator as object),
      },
      matchMedia: win.matchMedia,
    };
    context.window = context;
    vm.runInNewContext(MOVED_SOURCE, context);
    return { replace, open, tab, app };
  }

  it("shows the notice instead of redirecting (navigator.standalone)", async () => {
    const r = run({ navigator: { standalone: true } });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(r.replace).not.toHaveBeenCalled();
    expect(r.app.hidden).toBe(false);
    expect(r.tab.hidden).toBe(true);
    expect(r.open.setAttribute).toHaveBeenCalledWith(
      "href",
      "https://jim.gentryriggen.com/jim"
    );
  });

  it("shows the notice for display-mode standalone, after the wipe", async () => {
    const r = run({
      matchMedia: (q: string) => ({ matches: q.includes("standalone") }),
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(r.replace).not.toHaveBeenCalled();
    expect(r.app.hidden).toBe(false);
  });

  it("a browser tab still redirects", async () => {
    const r = run({ matchMedia: () => ({ matches: false }) });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(r.replace).toHaveBeenCalledTimes(1);
    expect(r.app.hidden).toBe(true);
  });
});

type Listener = (event: Record<string, unknown>) => void;

function loadKillSwitch() {
  const listeners = new Map<string, Listener>();
  const caches = fakeCaches([
    "jim-shell-v1",
    "jim-shell-v2",
    "ship-builder-v3",
  ]);
  const windows = [
    { url: `${OLD}/jim/notes`, navigate: jest.fn(async () => null) },
    { url: `${OLD}/jim`, navigate: jest.fn(async () => null) },
  ];
  const order: string[] = [];
  const self = {
    skipWaiting: jest.fn(async () => {}),
    clients: {
      claim: jest.fn(async () => void order.push("claim")),
      matchAll: jest.fn(async () => windows),
    },
    registration: {
      unregister: jest.fn(async () => {
        order.push("unregister");
        return true;
      }),
    },
    addEventListener: (type: string, listener: Listener) => {
      listeners.set(type, listener);
    },
  };
  vm.runInNewContext(KILL_SOURCE, { self, caches, Promise });

  async function dispatch(type: string) {
    const pending: Promise<unknown>[] = [];
    listeners.get(type)!({
      waitUntil: (promise: Promise<unknown>) => pending.push(promise),
    });
    await Promise.all(pending);
  }
  return { listeners, caches, windows, self, order, dispatch };
}

describe("kill-switch worker", () => {
  it("takes over at once", async () => {
    const worker = loadKillSwitch();
    await worker.dispatch("install");
    expect(worker.self.skipWaiting).toHaveBeenCalled();
  });

  it("clears Jim's shell, unregisters and reloads every window", async () => {
    const worker = loadKillSwitch();
    await worker.dispatch("activate");
    expect([...worker.caches.set]).toEqual(["ship-builder-v3"]);
    expect(worker.order).toEqual(["claim", "unregister"]);
    expect(worker.self.clients.matchAll).toHaveBeenCalledWith({
      type: "window",
    });
    for (const client of worker.windows) {
      expect(client.navigate).toHaveBeenCalledWith(client.url);
    }
  });

  it("still unregisters when the caches fail", async () => {
    const worker = loadKillSwitch();
    worker.caches.keys = async () => {
      throw new Error("SecurityError");
    };
    await worker.dispatch("activate");
    expect(worker.self.registration.unregister).toHaveBeenCalled();
    expect(worker.windows[0].navigate).toHaveBeenCalled();
  });

  it("has no fetch handler (everything goes to the network)", () => {
    const worker = loadKillSwitch();
    expect(worker.listeners.has("fetch")).toBe(false);
  });
});
