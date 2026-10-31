import {
  currentSubscription,
  disablePush,
  enablePush,
  isStandalone,
  keyBytes,
  needsHomeScreen,
  pushSupported,
} from "../push";

const API = "https://jim.example.test";
/** A made-up 4-byte "key", base64url. */
const KEY = "AQID_w";
const KEY_BYTES = [1, 2, 3, 255];

const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

function json(status: number, body: unknown = {}): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response;
}

interface FakeSub {
  endpoint: string;
  options: { applicationServerKey: ArrayBuffer | null };
  toJSON: () => unknown;
  unsubscribe: jest.Mock<Promise<boolean>, []>;
}

function fakeSub(key: number[] = KEY_BYTES): FakeSub {
  return {
    endpoint: "https://push.example.test/abc",
    options: { applicationServerKey: new Uint8Array(key).buffer },
    toJSON: () => ({
      endpoint: "https://push.example.test/abc",
      keys: { p256dh: "p", auth: "a" },
    }),
    unsubscribe: jest.fn(async () => true),
  };
}

let current: FakeSub | null;
let permission: NotificationPermission;
const subscribe = jest.fn();
const requestPermission = jest.fn();
let registered: boolean;

function setUa(ua: string, touch = 0) {
  Object.defineProperty(navigator, "userAgent", {
    value: ua,
    configurable: true,
  });
  Object.defineProperty(navigator, "maxTouchPoints", {
    value: touch,
    configurable: true,
  });
}

function setStandalone(on: boolean) {
  window.matchMedia = jest.fn((query: string) => ({
    matches: on && query === "(display-mode: standalone)",
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  current = null;
  permission = "granted";
  registered = true;
  subscribe.mockReset().mockImplementation(async () => {
    current = fakeSub();
    return current;
  });
  requestPermission.mockReset().mockImplementation(async () => permission);
  const registration = {
    pushManager: {
      getSubscription: async () => current,
      subscribe,
    },
  };
  Object.defineProperty(navigator, "serviceWorker", {
    value: {
      getRegistration: jest.fn(async () =>
        registered ? registration : undefined
      ),
      ready: Promise.resolve(registration),
    },
    configurable: true,
  });
  Object.defineProperty(window, "PushManager", {
    value: function PushManager() {},
    configurable: true,
  });
  Object.defineProperty(window, "Notification", {
    value: { requestPermission },
    configurable: true,
  });
  setUa(DESKTOP_UA);
  setStandalone(false);
});

afterEach(() => {
  Reflect.deleteProperty(navigator, "serviceWorker");
  Reflect.deleteProperty(window, "PushManager");
  Reflect.deleteProperty(window, "Notification");
});

/** Answers the push routes like the server would. */
function server(overrides: Record<string, Response> = {}) {
  return jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const route = `${init?.method} ${String(url).replace(API, "")}`;
    if (overrides[route]) return overrides[route];
    if (route === "GET /api/push/key") return json(200, { publicKey: KEY });
    return json(204);
  });
}

function routes(fetchFn: jest.Mock): string[] {
  return fetchFn.mock.calls.map(
    ([url, init]: [string, RequestInit]) =>
      `${init.method} ${url.replace(API, "")}`
  );
}

describe("support", () => {
  it("needs a service worker, PushManager and Notification", () => {
    expect(pushSupported()).toBe(true);
    Reflect.deleteProperty(window, "PushManager");
    expect(pushSupported()).toBe(false);
  });

  it("asks iOS to be on the Home Screen first", () => {
    expect(needsHomeScreen()).toBe(false);
    setUa(IPHONE_UA, 5);
    expect(needsHomeScreen()).toBe(true);
    setStandalone(true);
    expect(isStandalone()).toBe(true);
    expect(needsHomeScreen()).toBe(false);
  });

  it("counts an iPad (a Mac with touch) as iOS", () => {
    setUa(DESKTOP_UA, 5);
    expect(needsHomeScreen()).toBe(true);
  });

  it("reads Safari's navigator.standalone too", () => {
    Object.defineProperty(navigator, "standalone", {
      value: true,
      configurable: true,
    });
    expect(isStandalone()).toBe(true);
    Reflect.deleteProperty(navigator, "standalone");
  });

  it("decodes the base64url key", () => {
    expect([...keyBytes(KEY)]).toEqual(KEY_BYTES);
  });
});

describe("enablePush", () => {
  it("asks, subscribes with the server's key, hands it over, then tests", async () => {
    const fetchFn = server();
    await expect(enablePush(async () => "t", fetchFn, API)).resolves.toEqual({
      ok: true,
    });
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenCalledTimes(1);
    const options = subscribe.mock.calls[0][0];
    expect(options.userVisibleOnly).toBe(true);
    expect([...options.applicationServerKey]).toEqual(KEY_BYTES);
    expect(routes(fetchFn)).toEqual([
      "GET /api/push/key",
      "POST /api/push/subscribe",
      "POST /api/push/test",
    ]);
    const init = fetchFn.mock.calls[1][1]!;
    expect(JSON.parse(init.body as string)).toEqual(current!.toJSON());
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer t"
    );
  });

  it("asks for permission before anything else (iOS wants it in the tap)", async () => {
    const order: string[] = [];
    requestPermission.mockImplementation(async () => {
      order.push("permission");
      return "granted";
    });
    const fetchFn = jest.fn(
      async (url: RequestInfo | URL, init?: RequestInit) => {
        order.push(`${init?.method} ${String(url).replace(API, "")}`);
        return String(url).endsWith("/key")
          ? json(200, { publicKey: KEY })
          : json(204);
      }
    );
    await enablePush(async () => "t", fetchFn, API);
    expect(order[0]).toBe("permission");
  });

  it("stops at a denied or dismissed prompt", async () => {
    const fetchFn = server();
    permission = "denied";
    await expect(enablePush(async () => "t", fetchFn, API)).resolves.toEqual({
      ok: false,
      reason: "denied",
    });
    permission = "default";
    await expect(enablePush(async () => "t", fetchFn, API)).resolves.toEqual({
      ok: false,
      reason: "dismissed",
    });
    expect(subscribe).not.toHaveBeenCalled();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("says Home Screen first on iOS in a tab, without prompting", async () => {
    setUa(IPHONE_UA, 5);
    await expect(enablePush(async () => "t", server(), API)).resolves.toEqual({
      ok: false,
      reason: "home-screen",
    });
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it("drops the new subscription when the server doesn't take it", async () => {
    const fetchFn = server({ "POST /api/push/subscribe": json(503) });
    await expect(enablePush(async () => "t", fetchFn, API)).resolves.toEqual({
      ok: false,
      reason: "failed",
    });
    expect(current!.unsubscribe).toHaveBeenCalled();
    expect(routes(fetchFn)).not.toContain("POST /api/push/test");
  });

  it("fails without a key or a worker, and subscribes to nothing", async () => {
    await expect(
      enablePush(
        async () => "t",
        server({ "GET /api/push/key": json(200, {}) }),
        API
      )
    ).resolves.toEqual({ ok: false, reason: "failed" });
    registered = false;
    await expect(enablePush(async () => "t", server(), API)).resolves.toEqual({
      ok: false,
      reason: "failed",
    });
    expect(subscribe).not.toHaveBeenCalled();
  });

  it("is still on when only the test push fails", async () => {
    const fetchFn = server({ "POST /api/push/test": json(503) });
    await expect(enablePush(async () => "t", fetchFn, API)).resolves.toEqual({
      ok: true,
    });
  });

  it("reuses a subscription with the same key, replaces one with another", async () => {
    const same = fakeSub();
    current = same;
    await enablePush(async () => "t", server(), API);
    expect(subscribe).not.toHaveBeenCalled();
    expect(same.unsubscribe).not.toHaveBeenCalled();

    const stale = fakeSub([9, 9, 9, 9]);
    current = stale;
    await enablePush(async () => "t", server(), API);
    expect(stale.unsubscribe).toHaveBeenCalled();
    expect(subscribe).toHaveBeenCalledTimes(1);
  });
});

describe("disablePush", () => {
  it("tells the server which device and unsubscribes here", async () => {
    const sub = fakeSub();
    current = sub;
    const fetchFn = server();
    await disablePush(async () => "t", fetchFn, API);
    expect(routes(fetchFn)).toEqual(["DELETE /api/push/subscribe"]);
    expect(JSON.parse(fetchFn.mock.calls[0][1]!.body as string)).toEqual({
      endpoint: sub.endpoint,
    });
    expect(sub.unsubscribe).toHaveBeenCalled();
  });

  it("unsubscribes here even when the server can't be reached", async () => {
    const sub = fakeSub();
    current = sub;
    const fetchFn = jest.fn().mockRejectedValue(new TypeError("offline"));
    await expect(
      disablePush(async () => "t", fetchFn, API)
    ).resolves.toBeUndefined();
    expect(sub.unsubscribe).toHaveBeenCalled();
  });

  it("leaves the server alone when this device never subscribed", async () => {
    const fetchFn = server();
    await disablePush(async () => "t", fetchFn, API);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("does nothing where push isn't supported", async () => {
    Reflect.deleteProperty(window, "PushManager");
    expect(await currentSubscription()).toBeNull();
    const fetchFn = server();
    await disablePush(async () => "t", fetchFn, API);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
