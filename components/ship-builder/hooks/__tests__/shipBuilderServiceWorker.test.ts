import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ORIGIN = "https://gentryriggen.com";
const SW_SOURCE = readFileSync(
  path.join(process.cwd(), "public/ship-builder-sw.js"),
  "utf8"
);

interface FakeResponse {
  ok: boolean;
  type: string;
  redirected: boolean;
  body: string;
  clone: () => FakeResponse;
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
  overrides: Partial<Omit<FakeResponse, "clone" | "body">> = {}
): FakeResponse {
  const response: FakeResponse = {
    ok: true,
    type: "basic",
    redirected: false,
    body,
    clone: () => ({ ...response }),
    ...overrides,
  };
  return response;
}

function makeRequest(
  url: string,
  { method = "GET", mode = "no-cors", range = false } = {}
): FakeRequest {
  return {
    url,
    method,
    mode,
    headers: { has: (name) => range && name.toLowerCase() === "range" },
  };
}

function keyOf(request: FakeRequest | string): string {
  return typeof request === "string" ? request : request.url;
}

/** Loads the worker into a sandbox with in-memory caches and a fetch mock. */
function loadWorker() {
  const listeners = new Map<string, Listener>();
  const stores = new Map<string, Map<string, FakeResponse>>();
  const fetchMock = jest.fn<Promise<FakeResponse>, [string | FakeRequest]>();
  const claim = jest.fn(async () => {});

  function openStore(name: string) {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name)!;
    return {
      match: async (request: FakeRequest | string) => store.get(keyOf(request)),
      put: async (request: FakeRequest | string, response: FakeResponse) => {
        store.set(keyOf(request), response);
      },
    };
  }

  const caches = {
    open: async (name: string) => openStore(name),
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
  };

  const self = {
    location: { origin: ORIGIN },
    clients: { claim },
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
  });

  function dispatchFetch(request: FakeRequest) {
    let responded: Promise<FakeResponse> | undefined;
    listeners.get("fetch")!({
      request,
      respondWith: (promise: Promise<FakeResponse>) => {
        responded = promise;
      },
    });
    return responded;
  }

  async function dispatchExtendable(type: string, init = {}) {
    const pending: Promise<unknown>[] = [];
    listeners.get(type)!({
      ...init,
      waitUntil: (promise: Promise<unknown>) => pending.push(promise),
    });
    await Promise.all(pending);
  }

  return {
    stores,
    fetchMock,
    claim,
    dispatchFetch,
    dispatchExtendable,
    cacheKeys: () => [...(stores.get("ship-builder-v1")?.keys() ?? [])],
  };
}

describe("ship-builder service worker", () => {
  describe("fetch", () => {
    it.each([
      [
        "a non-GET request",
        makeRequest(`${ORIGIN}/_next/static/a.js`, { method: "POST" }),
      ],
      [
        "a cross-origin request",
        makeRequest("https://cdn.example.com/_next/static/a.js"),
      ],
      [
        "a navigation outside the app",
        makeRequest(`${ORIGIN}/`, { mode: "navigate" }),
      ],
      [
        "a lookalike path",
        makeRequest(`${ORIGIN}/ship-builderx`, { mode: "navigate" }),
      ],
      ["another same-origin asset", makeRequest(`${ORIGIN}/icon.svg`)],
      [
        "a range request",
        makeRequest(`${ORIGIN}/_next/static/a.mp4`, { range: true }),
      ],
    ])("passes %s through untouched", (_label, request) => {
      const worker = loadWorker();
      expect(worker.dispatchFetch(request)).toBeUndefined();
    });

    it("serves the page from the network and caches it without the query", async () => {
      const worker = loadWorker();
      worker.fetchMock.mockResolvedValue(makeResponse("page"));

      const response = await worker.dispatchFetch(
        makeRequest(`${ORIGIN}/ship-builder?ship=abc`, { mode: "navigate" })
      );

      expect(response?.body).toBe("page");
      expect(worker.cacheKeys()).toEqual([`${ORIGIN}/ship-builder`]);
    });

    it("falls back to the cached page when offline", async () => {
      const worker = loadWorker();
      worker.fetchMock.mockResolvedValueOnce(makeResponse("page"));
      await worker.dispatchFetch(
        makeRequest(`${ORIGIN}/ship-builder`, { mode: "navigate" })
      );

      worker.fetchMock.mockRejectedValueOnce(new TypeError("offline"));
      const response = await worker.dispatchFetch(
        makeRequest(`${ORIGIN}/ship-builder?ship=xyz`, { mode: "navigate" })
      );

      expect(response?.body).toBe("page");
    });

    it("never caches a sub-page as the game page", async () => {
      const worker = loadWorker();
      worker.fetchMock.mockResolvedValueOnce(makeResponse("versions"));
      await worker.dispatchFetch(
        makeRequest(`${ORIGIN}/ship-builder/versions`, { mode: "navigate" })
      );
      expect(worker.cacheKeys()).toEqual([`${ORIGIN}/ship-builder/versions`]);

      worker.fetchMock.mockResolvedValueOnce(makeResponse("game"));
      await worker.dispatchFetch(
        makeRequest(`${ORIGIN}/ship-builder`, { mode: "navigate" })
      );
      worker.fetchMock.mockRejectedValue(new TypeError("offline"));
      const game = await worker.dispatchFetch(
        makeRequest(`${ORIGIN}/ship-builder`, { mode: "navigate" })
      );
      const versions = await worker.dispatchFetch(
        makeRequest(`${ORIGIN}/ship-builder/versions`, { mode: "navigate" })
      );
      expect(game?.body).toBe("game");
      expect(versions?.body).toBe("versions");
    });

    it("rethrows when offline with nothing cached", async () => {
      const worker = loadWorker();
      worker.fetchMock.mockRejectedValue(new TypeError("offline"));

      await expect(
        worker.dispatchFetch(
          makeRequest(`${ORIGIN}/ship-builder`, { mode: "navigate" })
        )
      ).rejects.toThrow("offline");
    });

    it("serves static assets cache-first", async () => {
      const worker = loadWorker();
      const request = makeRequest(`${ORIGIN}/_next/static/chunks/a.js`);
      worker.fetchMock.mockResolvedValue(makeResponse("chunk"));

      await worker.dispatchFetch(request);
      const second = await worker.dispatchFetch(request);

      expect(second?.body).toBe("chunk");
      expect(worker.fetchMock).toHaveBeenCalledTimes(1);
    });

    it.each([
      ["opaque", { type: "opaque", ok: false }],
      ["cors", { type: "cors" }],
      ["error", { ok: false }],
      ["redirected", { redirected: true }],
    ])("never caches %s responses", async (_label, overrides) => {
      const worker = loadWorker();
      worker.fetchMock.mockResolvedValue(makeResponse("x", overrides));

      await worker.dispatchFetch(
        makeRequest(`${ORIGIN}/_next/static/chunks/a.js`)
      );
      await worker.dispatchFetch(
        makeRequest(`${ORIGIN}/ship-builder`, { mode: "navigate" })
      );

      expect(worker.cacheKeys()).toEqual([]);
    });
  });

  describe("activate", () => {
    it("deletes old ship-builder caches only, then claims clients", async () => {
      const worker = loadWorker();
      worker.stores.set("ship-builder-v0", new Map());
      worker.stores.set("ship-builder-v1", new Map());
      worker.stores.set("other-app", new Map());

      await worker.dispatchExtendable("activate");

      expect([...worker.stores.keys()].sort()).toEqual([
        "other-app",
        "ship-builder-v1",
      ]);
      expect(worker.claim).toHaveBeenCalled();
    });
  });

  describe("CACHE_URLS message", () => {
    const urls = [
      `${ORIGIN}/ship-builder?ship=abc#top`,
      `${ORIGIN}/_next/static/chunks/a.js`,
      `${ORIGIN}/_next/static/chunks/a.js`,
      `${ORIGIN}/`,
      `${ORIGIN}/icon.svg`,
      "https://evil.example.com/_next/static/x.js",
      "javascript:alert(1)",
      42,
    ];

    it("caches only same-origin app and static URLs from window clients", async () => {
      const worker = loadWorker();
      worker.fetchMock.mockImplementation(async (url) =>
        makeResponse(String(url))
      );

      await worker.dispatchExtendable("message", {
        source: { type: "window" },
        data: { type: "CACHE_URLS", urls },
      });

      expect(worker.fetchMock.mock.calls.map(([url]) => url).sort()).toEqual([
        `${ORIGIN}/_next/static/chunks/a.js`,
        `${ORIGIN}/ship-builder`,
      ]);
      expect(worker.cacheKeys().sort()).toEqual([
        `${ORIGIN}/_next/static/chunks/a.js`,
        `${ORIGIN}/ship-builder`,
      ]);
    });

    it.each([
      ["no source", undefined],
      ["a worker source", { type: "worker" }],
    ])("ignores messages with %s", async (_label, source) => {
      const worker = loadWorker();

      await worker.dispatchExtendable("message", {
        source,
        data: { type: "CACHE_URLS", urls },
      });

      expect(worker.fetchMock).not.toHaveBeenCalled();
    });

    it("ignores malformed messages", async () => {
      const worker = loadWorker();

      await worker.dispatchExtendable("message", {
        source: { type: "window" },
        data: { type: "CACHE_URLS", urls: "not-an-array" },
      });
      await worker.dispatchExtendable("message", {
        source: { type: "window" },
        data: null,
      });

      expect(worker.fetchMock).not.toHaveBeenCalled();
    });

    it("ignores individual fetch failures", async () => {
      const worker = loadWorker();
      worker.fetchMock
        .mockRejectedValueOnce(new TypeError("offline"))
        .mockResolvedValueOnce(makeResponse("ok"));

      await worker.dispatchExtendable("message", {
        source: { type: "window" },
        data: {
          type: "CACHE_URLS",
          urls: [`${ORIGIN}/_next/static/a.js`, `${ORIGIN}/_next/static/b.js`],
        },
      });

      expect(worker.cacheKeys()).toHaveLength(1);
    });
  });
});
