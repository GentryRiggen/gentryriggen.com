import { act, renderHook, waitFor } from "@testing-library/react";
import { JimError } from "../api";
import {
  MONEY_TIMEOUT_MS,
  clearMoney,
  fetchMoney,
  normalizeMoney,
  useMoney,
} from "../money";
import { MONEY_FIXTURE } from "./fixtures";

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

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

afterEach(() => {
  jest.restoreAllMocks();
  clearMoney();
});

describe("fetchMoney", () => {
  it("posts {} to /api/money with the bearer token", async () => {
    const fetchFn = jest.fn().mockResolvedValue(json(200, MONEY_FIXTURE));
    const data = await fetchMoney(async () => "t1", fetchFn, API);
    expect(data).toEqual(MONEY_FIXTURE);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(`${API}/api/money`);
    expect(init.method).toBe("POST");
    expect(init.body).toBe("{}");
    expect(init.headers.Authorization).toBe("Bearer t1");
  });

  it("is null when there's no money data (404)", async () => {
    const fetchFn = jest.fn().mockResolvedValue(json(404, { error: "x" }));
    await expect(fetchMoney(async () => "t", fetchFn, API)).resolves.toBe(null);
  });

  it("says waking for a 503, denied for a 403, server for a 500", async () => {
    const at = (status: number) =>
      kindOf(
        fetchMoney(
          async () => "t",
          jest.fn().mockResolvedValue(json(status, {})),
          API
        )
      );
    expect(await at(503)).toBe("waking");
    expect(await at(403)).toBe("denied");
    expect(await at(500)).toBe("server");
  });

  it("says server for a body that isn't a summary", async () => {
    const fetchFn = jest.fn().mockResolvedValue(json(200, { months: "x" }));
    expect(await kindOf(fetchMoney(async () => "t", fetchFn, API))).toBe(
      "server"
    );
  });

  it("keeps the stale flag", async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(json(200, { ...MONEY_FIXTURE, stale: true }));
    const data = await fetchMoney(async () => "t", fetchFn, API);
    expect(data?.stale).toBe(true);
  });

  it("times out as waking", async () => {
    jest.useFakeTimers();
    try {
      const fetchFn = jest.fn(() => new Promise<Response>(() => {}));
      const out = kindOf(fetchMoney(async () => "t", fetchFn, API));
      await act(async () => {
        jest.advanceTimersByTime(MONEY_TIMEOUT_MS + 1);
      });
      expect(await out).toBe("waking");
    } finally {
      jest.useRealTimers();
    }
  });

  it("never touches web storage or IndexedDB", async () => {
    const setItem = jest.spyOn(Storage.prototype, "setItem");
    const hadIdb = "indexedDB" in globalThis;
    const original = (globalThis as { indexedDB?: unknown }).indexedDB;
    const open = jest.fn();
    Object.defineProperty(globalThis, "indexedDB", {
      configurable: true,
      writable: true,
      value: { open },
    });
    try {
      const fetchFn = jest.fn().mockResolvedValue(json(200, MONEY_FIXTURE));
      await fetchMoney(async () => "t", fetchFn, API);
      const { result } = renderHook(() =>
        useMoney(async () => "t", API, true, fetchFn)
      );
      await waitFor(() => expect(result.current.data).not.toBeNull());
      expect(setItem).not.toHaveBeenCalled();
      expect(open).not.toHaveBeenCalled();
    } finally {
      if (hadIdb) {
        Object.defineProperty(globalThis, "indexedDB", {
          configurable: true,
          writable: true,
          value: original,
        });
      } else {
        delete (globalThis as { indexedDB?: unknown }).indexedDB;
      }
    }
  });
});

describe("normalizeMoney", () => {
  it("keeps a good summary as sent", () => {
    expect(normalizeMoney(MONEY_FIXTURE)).toEqual(MONEY_FIXTURE);
  });

  it("rejects something that isn't a summary", () => {
    expect(normalizeMoney(null)).toBeNull();
    expect(normalizeMoney([])).toBeNull();
    expect(normalizeMoney({ tiles: [] })).toBeNull();
  });

  it("drops malformed rows and fills in what's missing", () => {
    const [month] = MONEY_FIXTURE.months;
    const out = normalizeMoney({
      months: [month, { ...month, net: "12" }, null],
      tiles: [MONEY_FIXTURE.tiles[0], { label: "x", value: 3, tone: "" }],
      cash: [{ date: "2026-08-31", amount: Infinity }],
      checkin: "soon",
    });
    expect(out?.months).toEqual([month]);
    expect(out?.tiles).toEqual([MONEY_FIXTURE.tiles[0]]);
    expect(out?.cash).toEqual([]);
    expect(out?.checkin).toBeNull();
    expect(out?.groups).toEqual([]);
    expect(out?.rule).toBe("");
    expect(out?.watch).toBe("");
    expect(out?.typicalSpend).toBe(0);
  });
});

describe("useMoney", () => {
  it("doesn't fetch until the page is open, then holds the summary", async () => {
    const fetchFn = jest.fn().mockResolvedValue(json(200, MONEY_FIXTURE));
    const getToken = async () => "t";
    const { result, rerender } = renderHook(
      ({ active }) => useMoney(getToken, API, active, fetchFn),
      { initialProps: { active: false } }
    );
    expect(fetchFn).not.toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
    rerender({ active: true });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.data).toEqual(MONEY_FIXTURE);
    // Leaving and coming back keeps what's held.
    rerender({ active: false });
    rerender({ active: true });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("is ready with no data when there's no money data", async () => {
    const fetchFn = jest.fn().mockResolvedValue(json(404, {}));
    const { result } = renderHook(() =>
      useMoney(async () => "t", API, true, fetchFn)
    );
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.data).toBeNull();
  });

  it("reports the error kind and loads again on request", async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(json(503, {}))
      .mockResolvedValueOnce(json(200, MONEY_FIXTURE));
    const { result } = renderHook(() =>
      useMoney(async () => "t", API, true, fetchFn)
    );
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("waking");
    await act(async () => result.current.reload());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.data).toEqual(MONEY_FIXTURE);
    expect(result.current.error).toBeNull();
  });

  it("drops the summary on sign-out", async () => {
    const fetchFn = jest.fn().mockResolvedValue(json(200, MONEY_FIXTURE));
    const { result } = renderHook(() =>
      useMoney(async () => "t", API, true, fetchFn)
    );
    await waitFor(() => expect(result.current.data).not.toBeNull());
    act(() => clearMoney());
    expect(result.current.data).toBeNull();
    expect(result.current.status).toBe("idle");
  });

  it("doesn't keep a summary that lands after sign-out", async () => {
    const pending = deferred<Response>();
    const fetchFn = jest.fn(() => pending.promise);
    const { result } = renderHook(() =>
      useMoney(async () => "t", API, false, fetchFn)
    );
    act(() => {
      void result.current.reload();
    });
    act(() => clearMoney());
    await act(async () => pending.resolve(json(200, MONEY_FIXTURE)));
    expect(result.current.data).toBeNull();
    expect(result.current.status).toBe("idle");
  });
});
