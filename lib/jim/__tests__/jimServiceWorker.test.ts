import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ORIGIN = "https://gentryriggen.com";
const SW_SOURCE = readFileSync(
  path.join(process.cwd(), "public/jim-sw.js"),
  "utf8"
);
const PAGE = `${ORIGIN}/jim`;
const PAGE_HTML =
  '<script src="/_next/static/chunks/app.js"></script><link href="/_next/static/css/a.css">';

interface FakeResponse {
  ok: boolean;
  type: string;
  redirected: boolean;
  body: string;
  clone: () => FakeResponse;
  text: () => Promise<string>;
}

interface FakeRequest {
  url: string;
  method: string;
  mode: string;
  headers: { has: (name: string) => boolean };
}

type Listener = (event: Record<string, unknown>) => void;

function makeResponse(
  body: string,
  overrides: Partial<Omit<FakeResponse, "clone" | "body" | "text">> = {}
): FakeResponse {
  const response: FakeResponse = {
    ok: true,
    type: "basic",
    redirected: false,
    body,
    clone: () => ({ ...response }),
    text: async () => body,
    ...overrides,
  };
  return response;
}

function makeRequest(
  url: string,
  { method = "GET", mode = "no-cors" } = {}
): FakeRequest {
  return { url, method, mode, headers: { has: () => false } };
}

function keyOf(request: FakeRequest | string): string {
  return typeof request === "string" ? request : request.url;
}

/** Loads the worker into a sandbox with in-memory caches and mocks. */
function loadWorker() {
  const listeners = new Map<string, Listener>();
  const stores = new Map<string, Map<string, FakeResponse>>();
  const fetchMock = jest.fn<Promise<FakeResponse>, [string | FakeRequest]>();
  const showNotification = jest.fn(async () => {});
  const matchAll = jest.fn(async (): Promise<unknown[]> => []);
  const openWindow = jest.fn(async () => null);

  function openStore(name: string) {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name)!;
    return {
      match: async (request: FakeRequest | string) => store.get(keyOf(request)),
      put: async (request: FakeRequest | string, response: FakeResponse) => {
        store.set(keyOf(request), response);
      },
      keys: async () => [...store.keys()].map((url) => ({ url })),
      delete: async (request: { url: string } | string) =>
        store.delete(typeof request === "string" ? request : request.url),
    };
  }

  /** Set to make caches.open throw (WebKit's InvalidStateError). */
  const broken = { open: false };
  const caches = {
    open: async (name: string) => {
      if (broken.open) throw new Error("InvalidStateError");
      return openStore(name);
    },
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
  };

  const self = {
    location: { origin: ORIGIN },
    clients: { claim: jest.fn(async () => {}), matchAll, openWindow },
    registration: { showNotification },
    skipWaiting: jest.fn(),
    addEventListener: (type: string, listener: Listener) => {
      listeners.set(type, listener);
    },
  };

  vm.runInNewContext(SW_SOURCE, {
    self,
    caches,
    fetch: fetchMock,
    URL,
    Set,
    Promise,
    // The 4s navigation timeout fires on the next tick in tests.
    setTimeout: (fn: () => void) => setTimeout(fn, 0),
  });

  const waitUntil = jest.fn();

  function dispatchFetch(request: FakeRequest) {
    let responded: Promise<FakeResponse> | undefined;
    listeners.get("fetch")!({
      request,
      waitUntil,
      respondWith: (promise: Promise<FakeResponse>) => {
        responded = promise;
      },
    });
    return responded;
  }

  async function dispatch(type: string, init = {}) {
    const pending: Promise<unknown>[] = [];
    listeners.get(type)!({
      ...init,
      waitUntil: (promise: Promise<unknown>) => pending.push(promise),
    });
    await Promise.all(pending);
  }

  return {
    stores,
    broken,
    waitUntil,
    fetchMock,
    showNotification,
    matchAll,
    openWindow,
    skipWaiting: self.skipWaiting,
    dispatchFetch,
    dispatch,
    cacheKeys: () => [...(stores.get("jim-shell-v1")?.keys() ?? [])].sort(),
  };
}

describe("install and activate", () => {
  it("precaches /jim and the static files its HTML names", async () => {
    const worker = loadWorker();
    worker.fetchMock.mockImplementation(async (req) =>
      makeResponse(keyOf(req) === PAGE ? PAGE_HTML : "asset")
    );
    await worker.dispatch("install");
    expect(worker.cacheKeys()).toEqual([
      `${ORIGIN}/_next/static/chunks/app.js`,
      `${ORIGIN}/_next/static/css/a.css`,
      PAGE,
    ]);
  });

  it("installs even when offline", async () => {
    const worker = loadWorker();
    worker.fetchMock.mockRejectedValue(new TypeError("offline"));
    await expect(worker.dispatch("install")).resolves.toBeUndefined();
  });

  it("deletes its own old caches only", async () => {
    const worker = loadWorker();
    worker.stores.set("jim-shell-v0", new Map());
    worker.stores.set("ship-builder-v1", new Map());
    worker.stores.set("jim-shell-v1", new Map());
    await worker.dispatch("activate");
    expect([...worker.stores.keys()].sort()).toEqual([
      "jim-shell-v1",
      "ship-builder-v1",
    ]);
  });
});

describe("fetch", () => {
  it.each([
    ["a POST", makeRequest(`${ORIGIN}/_next/static/a.js`, { method: "POST" })],
    ["the Jim server", makeRequest("https://jim.example.run.app/api/view")],
    ["a same-origin /api call", makeRequest(`${ORIGIN}/api/view`)],
    [
      "a same-origin /api navigation",
      makeRequest(`${ORIGIN}/api/x`, { mode: "navigate" }),
    ],
    ["another page", makeRequest(`${ORIGIN}/`, { mode: "navigate" })],
    ["a lookalike page", makeRequest(`${ORIGIN}/jimmy`, { mode: "navigate" })],
    [
      "the ship builder",
      makeRequest(`${ORIGIN}/ship-builder`, { mode: "navigate" }),
    ],
    ["an icon", makeRequest(`${ORIGIN}/jim-icons/glow-pal-192.png`)],
    [
      "a file under /jim/",
      makeRequest(`${ORIGIN}/jim/version.json`, { mode: "navigate" }),
    ],
    [
      "a lookalike deep page",
      makeRequest(`${ORIGIN}/jimmy/notes`, { mode: "navigate" }),
    ],
  ])("leaves %s alone", (_label, request) => {
    expect(loadWorker().dispatchFetch(request)).toBeUndefined();
  });

  it("serves /jim from the network and keeps it as /jim", async () => {
    const worker = loadWorker();
    worker.fetchMock.mockResolvedValue(makeResponse("page"));
    const response = await worker.dispatchFetch(
      makeRequest(`${ORIGIN}/jim?x=1`, { mode: "navigate" })
    );
    expect(response?.body).toBe("page");
    expect(worker.cacheKeys()).toEqual([PAGE]);
  });

  it.each([
    "/jim/chat",
    "/jim/notes",
    "/jim/notes/people/sam-okafor",
    "/jim/notes/note/home/garden",
  ])(
    "serves the app address %s like /jim, offline too, kept as /jim",
    async (path) => {
      const worker = loadWorker();
      worker.fetchMock.mockResolvedValueOnce(makeResponse("page"));
      const online = await worker.dispatchFetch(
        makeRequest(`${ORIGIN}${path}`, { mode: "navigate" })
      );
      expect(online?.body).toBe("page");
      // Never a person's or note's address in the cache: the one page.
      expect(worker.cacheKeys()).toEqual([PAGE]);

      worker.fetchMock.mockRejectedValueOnce(new TypeError("offline"));
      const offline = await worker.dispatchFetch(
        makeRequest(`${ORIGIN}${path}`, { mode: "navigate" })
      );
      expect(offline?.body).toBe("page");
    }
  );

  it("falls back to the cached page offline, and when slow", async () => {
    const worker = loadWorker();
    worker.fetchMock.mockResolvedValueOnce(makeResponse("page"));
    await worker.dispatchFetch(makeRequest(PAGE, { mode: "navigate" }));

    worker.fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    expect(
      (await worker.dispatchFetch(makeRequest(PAGE, { mode: "navigate" })))
        ?.body
    ).toBe("page");

    worker.fetchMock.mockReturnValueOnce(new Promise(() => {}));
    expect(
      (
        await worker.dispatchFetch(
          makeRequest(`${ORIGIN}/jim.html`, { mode: "navigate" })
        )
      )?.body
    ).toBe("page");
  });

  it("calls waitUntil before anything is awaited", () => {
    const worker = loadWorker();
    worker.fetchMock.mockReturnValue(new Promise(() => {}));
    worker.dispatchFetch(makeRequest(PAGE, { mode: "navigate" }));
    // Synchronously, inside the fetch event.
    expect(worker.waitUntil).toHaveBeenCalledTimes(1);
  });

  it("still serves the page when the cache can't be opened", async () => {
    const worker = loadWorker();
    worker.broken.open = true;
    worker.fetchMock.mockResolvedValue(makeResponse("page"));
    const response = await worker.dispatchFetch(
      makeRequest(PAGE, { mode: "navigate" })
    );
    expect(response?.body).toBe("page");
  });

  it("serves static files cache-first and never caches a failed one", async () => {
    const worker = loadWorker();
    const url = `${ORIGIN}/_next/static/chunks/app.js`;
    worker.fetchMock.mockResolvedValueOnce(makeResponse("bad", { ok: false }));
    await worker.dispatchFetch(makeRequest(url));
    expect(worker.cacheKeys()).toEqual([]);
    worker.fetchMock.mockResolvedValueOnce(makeResponse("js"));
    await worker.dispatchFetch(makeRequest(url));
    const again = await worker.dispatchFetch(makeRequest(url));
    expect(again?.body).toBe("js");
    expect(worker.fetchMock).toHaveBeenCalledTimes(2);
  });

  it("prunes static files a new deploy no longer uses", async () => {
    const worker = loadWorker();
    worker.fetchMock.mockImplementation(async (req) =>
      makeResponse(keyOf(req) === PAGE ? PAGE_HTML : "asset")
    );
    await worker.dispatch("install");
    worker.fetchMock.mockResolvedValueOnce(
      makeResponse('<script src="/_next/static/chunks/app.js"></script>')
    );
    await worker.dispatchFetch(makeRequest(PAGE, { mode: "navigate" }));
    await new Promise((r) => setTimeout(r, 0));
    expect(worker.cacheKeys()).toEqual([
      `${ORIGIN}/_next/static/chunks/app.js`,
      PAGE,
    ]);
  });
});

describe("CACHE_URLS", () => {
  it("caches the page and static files it is sent, nothing else", async () => {
    const worker = loadWorker();
    worker.fetchMock.mockResolvedValue(makeResponse("x"));
    await worker.dispatch("message", {
      source: { type: "window" },
      data: {
        type: "CACHE_URLS",
        urls: [
          `${ORIGIN}/jim?q=1`,
          `${ORIGIN}/_next/static/chunks/auth.js`,
          `${ORIGIN}/api/view`,
          "https://jim.example.run.app/api/view",
          `${ORIGIN}/`,
        ],
      },
    });
    expect(worker.cacheKeys()).toEqual([
      `${ORIGIN}/_next/static/chunks/auth.js`,
      PAGE,
    ]);
  });

  it("keeps a page loaded at a deep address as /jim, fetched as /jim", async () => {
    const worker = loadWorker();
    worker.fetchMock.mockResolvedValue(makeResponse("x"));
    await worker.dispatch("message", {
      source: { type: "window" },
      data: {
        type: "CACHE_URLS",
        urls: [`${ORIGIN}/jim/notes/people/sam-okafor`],
      },
    });
    expect(worker.cacheKeys()).toEqual([PAGE]);
    expect(worker.fetchMock).toHaveBeenCalledWith(PAGE, {
      credentials: "same-origin",
    });
  });
});

describe("waiting and SKIP_WAITING", () => {
  it("does not skip waiting on install", async () => {
    const worker = loadWorker();
    worker.fetchMock.mockResolvedValue(makeResponse("x"));
    await worker.dispatch("install");
    expect(worker.skipWaiting).not.toHaveBeenCalled();
  });

  it("skips waiting when a page asks", async () => {
    const worker = loadWorker();
    await worker.dispatch("message", {
      source: { type: "window" },
      data: { type: "SKIP_WAITING" },
    });
    expect(worker.skipWaiting).toHaveBeenCalledTimes(1);
  });

  it("ignores SKIP_WAITING from anything but a window", async () => {
    const worker = loadWorker();
    await worker.dispatch("message", {
      source: { type: "worker" },
      data: { type: "SKIP_WAITING" },
    });
    await worker.dispatch("message", { data: { type: "SKIP_WAITING" } });
    expect(worker.skipWaiting).not.toHaveBeenCalled();
  });
});

describe("push", () => {
  function pushData(value: unknown) {
    return {
      json: () => {
        if (typeof value === "string") return JSON.parse(value);
        return value;
      },
    };
  }

  it("shows the briefing with Jim's icon", async () => {
    const worker = loadWorker();
    await worker.dispatch("push", {
      data: pushData({ title: "Good morning", body: "2 due", url: "/jim" }),
    });
    expect(worker.showNotification).toHaveBeenCalledWith("Good morning", {
      body: "2 due",
      icon: "/jim-icons/glow-pal-192.png",
      badge: "/jim-icons/glow-pal-192.png",
      tag: "jim-morning",
      data: { url: PAGE },
    });
  });

  it.each([
    ["jim-quiz", "jim-quiz"],
    ["Jim-Quiz", "jim-morning"],
    ["other-tag", "jim-morning"],
    [7, "jim-morning"],
  ])(
    "uses the payload's tag %p only when it's a jim- tag",
    async (tag, want) => {
      const worker = loadWorker();
      await worker.dispatch("push", {
        data: pushData({ title: "Quiz time", body: "b", url: "/jim", tag }),
      });
      const [, options] = worker.showNotification.mock.calls[0] as unknown as [
        string,
        { tag: string },
      ];
      expect(options.tag).toBe(want);
    }
  );

  it.each([
    ["no payload", undefined],
    ["a payload that isn't JSON", pushData("not json{")],
    ["a payload with no title", pushData({ body: "x" })],
  ])("still shows a notification for %s", async (_label, data) => {
    const worker = loadWorker();
    await worker.dispatch("push", { data });
    expect(worker.showNotification).toHaveBeenCalledTimes(1);
    const [title, options] = worker.showNotification.mock
      .calls[0] as unknown as [string, { data: { url: string } }];
    expect(title).toBe("Jim");
    expect(options.data.url).toBe(PAGE);
  });

  it("never points a tap off /jim", async () => {
    const worker = loadWorker();
    await worker.dispatch("push", {
      data: pushData({ title: "Hi", body: "", url: "https://evil.test/" }),
    });
    const [, options] = worker.showNotification.mock.calls[0] as unknown as [
      string,
      { data: { url: string } },
    ];
    expect(options.data.url).toBe(PAGE);
  });
});

describe("notificationclick", () => {
  function click() {
    return { close: jest.fn(), data: { url: PAGE } };
  }

  it("focuses an open /jim", async () => {
    const worker = loadWorker();
    const focus = jest.fn(async () => {});
    worker.matchAll.mockResolvedValue([
      { url: `${ORIGIN}/`, focus: jest.fn() },
      { url: PAGE, focus },
    ]);
    const notification = click();
    await worker.dispatch("notificationclick", { notification });
    expect(notification.close).toHaveBeenCalled();
    expect(focus).toHaveBeenCalled();
    expect(worker.openWindow).not.toHaveBeenCalled();
  });

  it("focuses Jim open at a deep address", async () => {
    const worker = loadWorker();
    const focus = jest.fn(async () => {});
    worker.matchAll.mockResolvedValue([
      { url: `${ORIGIN}/jim/notes/people/sam-okafor`, focus },
    ]);
    await worker.dispatch("notificationclick", { notification: click() });
    expect(focus).toHaveBeenCalled();
    expect(worker.openWindow).not.toHaveBeenCalled();
  });

  it("keeps a /jim?say= query when opening", async () => {
    const worker = loadWorker();
    const url = `${PAGE}?say=quiz%20me`;
    await worker.dispatch("notificationclick", {
      notification: { close: jest.fn(), data: { url } },
    });
    expect(worker.openWindow).toHaveBeenCalledWith(url);
  });

  it("tells an open /jim the say text instead of reloading it", async () => {
    const worker = loadWorker();
    const url = `${PAGE}?say=quiz%20me`;
    const focus = jest.fn(async () => {});
    const navigate = jest.fn(async () => {});
    const postMessage = jest.fn();
    worker.matchAll.mockResolvedValue([
      { url: PAGE, focus, navigate, postMessage },
    ]);
    await worker.dispatch("notificationclick", {
      notification: { close: jest.fn(), data: { url } },
    });
    expect(focus).toHaveBeenCalled();
    expect(postMessage).toHaveBeenCalledWith({
      type: "JIM_SAY",
      say: "quiz me",
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(worker.openWindow).not.toHaveBeenCalled();
  });

  it("does the same for a client the worker doesn't control yet", async () => {
    const worker = loadWorker();
    const postMessage = jest.fn();
    // matchAll is asked for uncontrolled clients too; one has no navigate.
    worker.matchAll.mockResolvedValue([
      {
        url: `${PAGE}?say=keep%20going`,
        focus: jest.fn(async () => {}),
        postMessage,
      },
    ]);
    await worker.dispatch("notificationclick", {
      notification: {
        close: jest.fn(),
        data: { url: `${PAGE}?say=keep%20going` },
      },
    });
    expect(worker.matchAll).toHaveBeenCalledWith(
      expect.objectContaining({ includeUncontrolled: true })
    );
    expect(postMessage).toHaveBeenCalledWith({
      type: "JIM_SAY",
      say: "keep going",
    });
  });

  it("sends nothing to an open /jim for a plain tap", async () => {
    const worker = loadWorker();
    const postMessage = jest.fn();
    worker.matchAll.mockResolvedValue([
      { url: PAGE, focus: jest.fn(async () => {}), postMessage },
    ]);
    await worker.dispatch("notificationclick", { notification: click() });
    expect(postMessage).not.toHaveBeenCalled();
  });

  it("opens /jim when it isn't open", async () => {
    const worker = loadWorker();
    worker.matchAll.mockResolvedValue([
      { url: `${ORIGIN}/`, focus: jest.fn() },
    ]);
    await worker.dispatch("notificationclick", { notification: click() });
    expect(worker.openWindow).toHaveBeenCalledWith(PAGE);
  });
});
