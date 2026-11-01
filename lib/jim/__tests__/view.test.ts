import { JimError } from "../api";
import {
  VIEW_TIMEOUT_MS,
  clearViewCache,
  fetchView,
  getCachedView,
  normalizeView,
  setViewSaver,
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

  it("leaves the newer fields out when an older server sends none", () => {
    const view = normalizeView({ today: "2026-10-31" });
    expect(view?.actions).toBeUndefined();
    expect(view?.actionsAsOf).toBeUndefined();
    expect(view?.daily).toBeUndefined();
    expect(view?.dates).toBeUndefined();
    expect(view?.work).toBeUndefined();
  });

  it("keeps every newer field of a good payload as sent", () => {
    const view = normalizeView(VIEW_FIXTURE);
    expect(view?.actions).toEqual(VIEW_FIXTURE.actions);
    expect(view?.actionsAsOf).toBe(VIEW_FIXTURE.actionsAsOf);
    expect(view?.daily).toEqual(VIEW_FIXTURE.daily);
    expect(view?.dates).toEqual(VIEW_FIXTURE.dates);
    expect(view?.work).toEqual(VIEW_FIXTURE.work);
  });

  it("keeps a good action and drops a malformed one", () => {
    const good = VIEW_FIXTURE.actions![0];
    const view = normalizeView({
      today: "2026-10-31",
      actions: [good, { ...good, tone: 5 }, { ...good, title: null }, "x"],
    });
    expect(view?.actions).toEqual([good]);
  });

  it("never links an action anywhere but https", () => {
    const good = VIEW_FIXTURE.actions![0];
    const view = normalizeView({
      today: "2026-10-31",
      actions: [{ ...good, link: "javascript:alert(1)" }],
    });
    expect(view?.actions?.[0].link).toBe("");
  });

  it("drops a daily word, dates and work that aren't the right shape", () => {
    const date = VIEW_FIXTURE.dates![0];
    const view = normalizeView({
      today: "2026-10-31",
      daily: "word",
      dates: [
        date,
        { ...date, days: "3" },
        { ...date, kind: "party" },
        { ...date, days: Number.NaN },
        { ...date, days: Number.POSITIVE_INFINITY },
      ],
      work: [],
    });
    expect(view?.daily).toBeNull();
    expect(view?.dates).toEqual([date]);
    expect(view?.work).toBeUndefined();
  });

  it("turns a non-finite age into null", () => {
    const date = VIEW_FIXTURE.dates![0];
    const view = normalizeView({
      today: "2026-10-31",
      dates: [{ ...date, turns: Number.NaN }],
    });
    expect(view?.dates?.[0].turns).toBeNull();
  });

  it("drops bad work entries one by one and keeps the rest", () => {
    const work = VIEW_FIXTURE.work!;
    const [member] = work.team;
    const [meeting] = work.meetings;
    const [person] = work.directory.people;
    const view = normalizeView({
      today: "2026-10-31",
      work: {
        team: [member, { ...member, wins: "two" }],
        winsByWeek: [
          work.winsByWeek[0],
          { week: "2026-10-26", counts: { You: "1" } },
        ],
        winsKeys: ["You", 7],
        meetings: [meeting, { ...meeting, people: "Ava" }],
        directory: {
          updated: work.directory.updated,
          people: [person, { ...person, reportIds: ["1"] }, null],
        },
      },
    });
    expect(view?.work?.team).toEqual([member]);
    expect(view?.work?.winsByWeek).toEqual([work.winsByWeek[0]]);
    expect(view?.work?.winsKeys).toEqual(["You"]);
    expect(view?.work?.meetings).toEqual([meeting]);
    expect(view?.work?.directory.people).toEqual([person]);
  });

  it("fills in a work payload with lists missing", () => {
    const view = normalizeView({ today: "2026-10-31", work: {} });
    expect(view?.work).toEqual({
      team: [],
      winsByWeek: [],
      winsKeys: [],
      meetings: [],
      directory: { updated: "", people: [] },
    });
  });
});

describe("keeping payloads on the device", () => {
  it("hands each good payload to the saver, until sign-out", async () => {
    const saver = jest.fn();
    setViewSaver(saver);
    const fetchFn = jest.fn().mockResolvedValue(json(200, VIEW_FIXTURE));
    await fetchView(async () => "t", fetchFn, API);
    expect(saver).toHaveBeenCalledTimes(1);
    expect(saver.mock.calls[0][0].today).toBe("2026-10-31");

    clearViewCache();
    await fetchView(async () => "t", fetchFn, API);
    expect(saver).toHaveBeenCalledTimes(1);
  });

  it("doesn't save a payload whose fetch outlived the sign-in", async () => {
    const saver = jest.fn();
    setViewSaver(saver);
    let answer: (res: Response) => void = () => {};
    const fetchFn = jest.fn(
      () => new Promise<Response>((resolve) => (answer = resolve))
    );
    const out = fetchView(async () => "t", fetchFn, API);
    await Promise.resolve();
    await Promise.resolve();
    clearViewCache();
    setViewSaver(saver);
    answer(json(200, VIEW_FIXTURE));
    await out;
    expect(saver).not.toHaveBeenCalled();
  });

  it("doesn't save a failed fetch", async () => {
    const saver = jest.fn();
    setViewSaver(saver);
    const fetchFn = jest.fn().mockResolvedValue(json(500, {}));
    await expect(fetchView(async () => "t", fetchFn, API)).rejects.toThrow();
    expect(saver).not.toHaveBeenCalled();
  });
});
