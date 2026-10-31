import { JimError } from "../api";
import { CALL_TIMEOUT_MS, fetchNote, searchNotes, toggleTodo } from "../view";

const API = "https://jim.example.test";
const TODO = { order: 3, text: "Water the plants (due 2026-10-31)" };

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

afterEach(() => jest.useRealTimers());

describe("toggleTodo", () => {
  it("posts the todo's order, text and done with the bearer token", async () => {
    const getToken = jest.fn().mockResolvedValue("t1");
    const fetchFn = jest
      .fn()
      .mockResolvedValue(
        json(200, { ok: true, commit: "abcdef123", sha: "abcdef1" })
      );
    await expect(
      toggleTodo(TODO, true, getToken, fetchFn, API)
    ).resolves.toEqual({ ok: true, sha: "abcdef1" });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(`${API}/api/todo`);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer t1");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({
      order: 3,
      text: "Water the plants (due 2026-10-31)",
      done: true,
    });
  });

  it("refreshes the token once after a 401 and retries", async () => {
    const getToken = jest
      .fn()
      .mockResolvedValueOnce("old")
      .mockResolvedValueOnce("new");
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(json(401, {}))
      .mockResolvedValueOnce(json(200, { ok: true, commit: "c", sha: "s" }));
    await expect(
      toggleTodo(TODO, false, getToken, fetchFn, API)
    ).resolves.toEqual({ ok: true, sha: "s" });
    expect(getToken.mock.calls).toEqual([[false], [true]]);
    expect(fetchFn.mock.calls[1][1].headers.Authorization).toBe("Bearer new");
    expect(JSON.parse(fetchFn.mock.calls[1][1].body).done).toBe(false);
  });

  it("passes on the server's message when the todo changed (409)", async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(
        json(409, { error: "That todo changed. Pull to refresh." })
      );
    await expect(
      toggleTodo(TODO, true, async () => "t", fetchFn, API)
    ).resolves.toEqual({
      ok: false,
      reason: "changed",
      message: "That todo changed. Pull to refresh.",
    });
  });

  it("has its own words for a 409 without a message", async () => {
    const fetchFn = jest.fn().mockResolvedValue(json(409, {}));
    const result = await toggleTodo(TODO, true, async () => "t", fetchFn, API);
    expect(result).toEqual({
      ok: false,
      reason: "changed",
      message: "That todo changed. Pull to refresh.",
    });
  });

  it("says couldn't save for a 503, a network error or another status", async () => {
    for (const fetchFn of [
      jest.fn().mockResolvedValue(json(503, { error: "busy" })),
      jest.fn().mockRejectedValue(new TypeError("Failed to fetch")),
      jest.fn().mockResolvedValue(json(500, {})),
    ]) {
      await expect(
        toggleTodo(TODO, true, async () => "t", fetchFn, API)
      ).resolves.toEqual({
        ok: false,
        reason: "failed",
        message: "Couldn't save. Try again.",
      });
    }
  });

  it("is denied after a second 401 or with no signed-in user", async () => {
    const fetchFn = jest.fn().mockResolvedValue(json(401, {}));
    expect(
      await toggleTodo(TODO, true, async () => "t", fetchFn, API)
    ).toMatchObject({ ok: false, reason: "denied" });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(
      await toggleTodo(TODO, true, async () => null, jest.fn(), API)
    ).toMatchObject({ ok: false, reason: "denied" });
  });

  it("never calls out when Jim isn't connected", async () => {
    const fetchFn = jest.fn();
    expect(
      await toggleTodo(TODO, true, async () => "t", fetchFn, "")
    ).toMatchObject({ ok: false, reason: "failed" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("gives up after 15 seconds", async () => {
    jest.useFakeTimers();
    const fetchFn = jest.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError"))
          );
        })
    );
    const result = toggleTodo(
      TODO,
      true,
      async () => "t",
      fetchFn as unknown as typeof fetch,
      API
    );
    await jest.advanceTimersByTimeAsync(CALL_TIMEOUT_MS + 1);
    await expect(result).resolves.toMatchObject({
      ok: false,
      reason: "failed",
    });
    expect(CALL_TIMEOUT_MS).toBe(15_000);
  });
});

describe("searchNotes", () => {
  it("gets the results for an encoded query", async () => {
    const getToken = jest.fn().mockResolvedValue("t1");
    const fetchFn = jest.fn().mockResolvedValue(
      json(200, {
        results: [
          {
            path: "home/garden.md",
            title: "Garden",
            snippet: "Water the plants",
          },
          { path: 4, title: "broken" },
        ],
      })
    );
    await expect(
      searchNotes("plants & pots", getToken, fetchFn, API)
    ).resolves.toEqual([
      { path: "home/garden.md", title: "Garden", snippet: "Water the plants" },
    ]);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(`${API}/api/search?q=plants%20%26%20pots`);
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer t1");
  });

  it("caps the query at 100 characters", async () => {
    const fetchFn = jest.fn().mockResolvedValue(json(200, { results: [] }));
    await searchNotes("a".repeat(150), async () => "t", fetchFn, API);
    expect(fetchFn.mock.calls[0][0]).toBe(
      `${API}/api/search?q=${"a".repeat(100)}`
    );
  });

  it("retries once after a 401, then is denied", async () => {
    const fetchFn = jest.fn().mockResolvedValue(json(401, {}));
    expect(await kindOf(searchNotes("ab", async () => "t", fetchFn, API))).toBe(
      "denied"
    );
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("says waking for a 503 or a dropped connection, server otherwise", async () => {
    expect(
      await kindOf(
        searchNotes(
          "ab",
          async () => "t",
          jest.fn().mockResolvedValue(json(503, {})),
          API
        )
      )
    ).toBe("waking");
    expect(
      await kindOf(
        searchNotes(
          "ab",
          async () => "t",
          jest.fn().mockRejectedValue(new TypeError("x")),
          API
        )
      )
    ).toBe("waking");
    expect(
      await kindOf(
        searchNotes(
          "ab",
          async () => "t",
          jest.fn().mockResolvedValue(json(200, { nope: 1 })),
          API
        )
      )
    ).toBe("server");
  });
});

describe("fetchNote", () => {
  const NOTE = {
    path: "home/garden.md",
    title: "Garden",
    updated: "2026-10-01",
    body: "## Beds\n- Tomatoes",
  };

  it("gets a note by its encoded path", async () => {
    const fetchFn = jest.fn().mockResolvedValue(json(200, NOTE));
    await expect(
      fetchNote("home/garden.md", async () => "t", fetchFn, API)
    ).resolves.toEqual(NOTE);
    expect(fetchFn.mock.calls[0][0]).toBe(
      `${API}/api/note?path=home%2Fgarden.md`
    );
  });

  it("is null for a note that isn't there (404)", async () => {
    const fetchFn = jest.fn().mockResolvedValue(json(404, {}));
    await expect(
      fetchNote("home/gone.md", async () => "t", fetchFn, API)
    ).resolves.toBeNull();
  });

  it("says server for a body that isn't a note", async () => {
    const fetchFn = jest.fn().mockResolvedValue(json(200, { title: 1 }));
    expect(
      await kindOf(fetchNote("home/garden.md", async () => "t", fetchFn, API))
    ).toBe("server");
  });

  it("times out as waking", async () => {
    jest.useFakeTimers();
    const fetchFn = jest.fn(() => new Promise<Response>(() => {}));
    const result = kindOf(
      fetchNote("home/garden.md", async () => "t", fetchFn, API)
    );
    await jest.advanceTimersByTimeAsync(CALL_TIMEOUT_MS + 1);
    expect(await result).toBe("waking");
  });
});
