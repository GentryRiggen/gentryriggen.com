import { JimError } from "../api";
import {
  VIEW_TIMEOUT_MS,
  clearViewCache,
  fetchView,
  getCachedView,
  normalizeView,
} from "../view";
import { VIEW_FIXTURE } from "./fixtures";

const API = "https://jim.example.test";

function json(status: number, body: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response;
}

async function kindOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (err) {
    if (err instanceof JimError) return err.kind;
    throw err;
  }
  throw new Error("expected a JimError");
}

beforeEach(() => clearViewCache());

it("gets the view with the bearer token", async () => {
  const getToken = jest.fn().mockResolvedValue("t1");
  const fetchFn = jest.fn().mockResolvedValue(json(200, VIEW_FIXTURE));
  const data = await fetchView(getToken, fetchFn, API);
  expect(data.today).toBe("2026-10-31");
  expect(data.people).toHaveLength(VIEW_FIXTURE.people.length);
  const [url, init] = fetchFn.mock.calls[0];
  expect(url).toBe(`${API}/api/view`);
  expect(init.method).toBe("GET");
  expect(init.headers.Authorization).toBe("Bearer t1");
  expect(getToken).toHaveBeenCalledWith(false);
});

it("refreshes the token once after a 401 and retries", async () => {
  const getToken = jest
    .fn()
    .mockResolvedValueOnce("old")
    .mockResolvedValueOnce("new");
  const fetchFn = jest
    .fn()
    .mockResolvedValueOnce(json(401, {}))
    .mockResolvedValueOnce(json(200, VIEW_FIXTURE));
  await expect(fetchView(getToken, fetchFn, API)).resolves.toMatchObject({
    today: "2026-10-31",
  });
  expect(getToken.mock.calls).toEqual([[false], [true]]);
  expect(fetchFn.mock.calls[1][1].headers.Authorization).toBe("Bearer new");
});

it("gives up as denied after a second 401, or on a 403", async () => {
  const getToken = jest.fn().mockResolvedValue("t");
  const twice = jest.fn().mockResolvedValue(json(401, {}));
  expect(await kindOf(fetchView(getToken, twice, API))).toBe("denied");
  expect(twice).toHaveBeenCalledTimes(2);
  const forbidden = jest.fn().mockResolvedValue(json(403, {}));
  expect(await kindOf(fetchView(getToken, forbidden, API))).toBe("denied");
});

it("is denied with no signed-in user", async () => {
  const fetchFn = jest.fn();
  expect(
    await kindOf(fetchView(jest.fn().mockResolvedValue(null), fetchFn, API))
  ).toBe("denied");
  expect(fetchFn).not.toHaveBeenCalled();
});

it("says waking for a 503, a network error or a bad token fetch", async () => {
  const getToken = jest.fn().mockResolvedValue("t");
  expect(
    await kindOf(
      fetchView(getToken, jest.fn().mockResolvedValue(json(503, {})), API)
    )
  ).toBe("waking");
  expect(
    await kindOf(
      fetchView(getToken, jest.fn().mockRejectedValue(new TypeError()), API)
    )
  ).toBe("waking");
  expect(
    await kindOf(
      fetchView(
        jest.fn().mockRejectedValue(new Error("offline")),
        jest.fn(),
        API
      )
    )
  ).toBe("waking");
});

it("says server for another error or a body that isn't a view", async () => {
  const getToken = jest.fn().mockResolvedValue("t");
  expect(
    await kindOf(
      fetchView(getToken, jest.fn().mockResolvedValue(json(500, {})), API)
    )
  ).toBe("server");
  expect(
    await kindOf(
      fetchView(
        getToken,
        jest.fn().mockResolvedValue(json(200, { hello: 1 })),
        API
      )
    )
  ).toBe("server");
});

it("times out after 30 seconds as waking", async () => {
  expect(VIEW_TIMEOUT_MS).toBe(30_000);
  jest.useFakeTimers();
  try {
    const getToken = jest.fn().mockResolvedValue("t");
    const fetchFn = jest.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError"))
          );
        })
    );
    const result = kindOf(fetchView(getToken, fetchFn, API));
    await jest.advanceTimersByTimeAsync(VIEW_TIMEOUT_MS + 1);
    expect(await result).toBe("waking");
  } finally {
    jest.useRealTimers();
  }
});

it("caches the last good payload for the session", async () => {
  expect(getCachedView()).toBeNull();
  const getToken = jest.fn().mockResolvedValue("t");
  await fetchView(
    getToken,
    jest.fn().mockResolvedValue(json(200, VIEW_FIXTURE)),
    API
  );
  const cached = getCachedView();
  expect(cached?.data.today).toBe("2026-10-31");
  expect(typeof cached?.at).toBe("number");
  // A failure keeps the last good one.
  await kindOf(
    fetchView(getToken, jest.fn().mockResolvedValue(json(500, {})), API)
  );
  expect(getCachedView()?.data.today).toBe("2026-10-31");
});

it("shares a fetch that is already out (the early wake-up and Notes)", async () => {
  let respond: (r: Response) => void = () => {};
  const fetchFn = jest.fn(
    () => new Promise<Response>((resolve) => (respond = resolve))
  );
  const first = fetchView(async () => "t", fetchFn, API);
  const second = fetchView(async () => "t", fetchFn, API);
  await Promise.resolve();
  await Promise.resolve();
  respond(json(200, VIEW_FIXTURE));
  await expect(first).resolves.toMatchObject({ today: "2026-10-31" });
  await expect(second).resolves.toMatchObject({ today: "2026-10-31" });
  expect(fetchFn).toHaveBeenCalledTimes(1);
  // Once it's back, the next call fetches again.
  fetchFn.mockResolvedValueOnce(json(200, VIEW_FIXTURE));
  await fetchView(async () => "t", fetchFn, API);
  expect(fetchFn).toHaveBeenCalledTimes(2);
});

it("doesn't keep a payload that lands after sign-out", async () => {
  let respond: (r: Response) => void = () => {};
  const fetchFn = jest.fn(
    () => new Promise<Response>((resolve) => (respond = resolve))
  );
  const out = fetchView(async () => "t", fetchFn, API);
  await Promise.resolve();
  await Promise.resolve();
  clearViewCache();
  respond(json(200, VIEW_FIXTURE));
  await out;
  expect(getCachedView()).toBeNull();
});

describe("normalizeView", () => {
  it("fills in missing lists and a missing calendar", () => {
    const view = normalizeView({ today: "2026-10-31" });
    expect(view).not.toBeNull();
    expect(view?.todos).toEqual([]);
    expect(view?.people).toEqual([]);
    expect(view?.golf).toEqual([]);
    expect(view?.calendar).toBeNull();
    expect(view?.health.injections).toEqual([]);
    expect(view?.training.lifts).toEqual([]);
  });

  it("rejects something that isn't a view", () => {
    expect(normalizeView(null)).toBeNull();
    expect(normalizeView([])).toBeNull();
    expect(normalizeView({ today: 5 })).toBeNull();
  });

  it("drops a calendar with no event list", () => {
    expect(
      normalizeView({ today: "2026-10-31", calendar: { fetchedAt: "x" } })
        ?.calendar
    ).toBeNull();
  });

  it("keeps the stale flag", () => {
    expect(normalizeView({ today: "2026-10-31", stale: true })?.stale).toBe(
      true
    );
  });
});
