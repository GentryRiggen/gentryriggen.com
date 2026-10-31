import { TextDecoder, TextEncoder } from "util";
import {
  isJimConnected,
  JIM_IDLE_MS,
  JIM_TIMEOUT_MS,
  JimError,
  streamToJim,
  wakeJim,
  type JimStreamEvent,
} from "../api";

// jsdom has no TextDecoder; the browser and Node do.
Object.assign(globalThis, { TextDecoder, TextEncoder });

const API = "https://jim.example.test";

function headers(type: string) {
  return { get: (name: string) => (/content-type/i.test(name) ? type : null) };
}

/** jsdom has no Response, so fake the part streamToJim reads. */
function json(status: number, body: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: headers("application/json"),
    json: async () => body,
  } as unknown as Response;
}

/**
 * A 200 NDJSON response whose body arrives in these chunks. A chunk that is
 * an Error makes the read fail there (the connection dropped); `hang` leaves
 * the last read waiting forever.
 */
function ndjson(
  chunks: (string | Uint8Array | Error)[],
  { hang = false }: { hang?: boolean } = {}
): Response {
  const encoder = new TextEncoder();
  let at = 0;
  const cancel = jest.fn(async () => {});
  return {
    status: 200,
    ok: true,
    headers: headers("application/x-ndjson; charset=utf-8"),
    body: {
      getReader: () => ({
        read: async () => {
          if (at >= chunks.length) {
            if (hang) return new Promise(() => {});
            return { done: true, value: undefined };
          }
          const chunk = chunks[at++];
          if (chunk instanceof Error) throw chunk;
          return {
            done: false,
            value: typeof chunk === "string" ? encoder.encode(chunk) : chunk,
          };
        },
        cancel,
        releaseLock: () => {},
      }),
    },
    json: async () => {
      throw new Error("not JSON");
    },
  } as unknown as Response;
}

function line(event: object): string {
  return `${JSON.stringify(event)}\n`;
}

/** The old call shape, for the rules that are the same in both modes. */
function sendToJim(
  session: string,
  text: string,
  getToken: (force?: boolean) => Promise<string | null>,
  fetchFn: typeof fetch,
  api: string,
  timeoutMs?: number
) {
  return streamToJim(
    text,
    session,
    getToken,
    undefined,
    fetchFn,
    api,
    timeoutMs
  );
}

const ok = { reply: "Hi", changed: ["lists/todos.md"], commit: "abc123" };

async function kindOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (err) {
    if (err instanceof JimError) return err.kind;
    throw err;
  }
  throw new Error("expected a JimError");
}

it("posts the session and text with the bearer token", async () => {
  const getToken = jest.fn().mockResolvedValue("t1");
  const fetchFn = jest.fn().mockResolvedValue(json(200, ok));
  await expect(
    sendToJim("s1", "hello", getToken, fetchFn, API)
  ).resolves.toEqual(ok);
  expect(getToken).toHaveBeenCalledWith(false);
  const [url, init] = fetchFn.mock.calls[0];
  expect(url).toBe(`${API}/api/chat`);
  expect(init.method).toBe("POST");
  expect(init.headers.Authorization).toBe("Bearer t1");
  expect(init.headers["Content-Type"]).toBe("application/json");
  expect(init.headers.Accept).toBe("application/x-ndjson");
  expect(JSON.parse(init.body)).toEqual({ session: "s1", text: "hello" });
});

it("refreshes the token once after a 401 and returns the reply", async () => {
  const getToken = jest
    .fn()
    .mockResolvedValueOnce("t1")
    .mockResolvedValueOnce("t2");
  const fetchFn = jest
    .fn()
    .mockResolvedValueOnce(json(401, { error: "expired" }))
    .mockResolvedValueOnce(json(200, ok));
  await expect(sendToJim("s", "x", getToken, fetchFn, API)).resolves.toEqual(
    ok
  );
  expect(getToken.mock.calls).toEqual([[false], [true]]);
  expect(fetchFn.mock.calls[1][1].headers.Authorization).toBe("Bearer t2");
});

it("gives up as denied after two 401s", async () => {
  const getToken = jest.fn().mockResolvedValue("t");
  const fetchFn = jest.fn().mockResolvedValue(json(401, {}));
  expect(await kindOf(sendToJim("s", "x", getToken, fetchFn, API))).toBe(
    "denied"
  );
  expect(fetchFn).toHaveBeenCalledTimes(2);
  expect(getToken).toHaveBeenCalledWith(true);
});

it("is denied on 403 and when there is no signed-in user", async () => {
  const fetchFn = jest.fn().mockResolvedValue(json(403, {}));
  expect(await kindOf(sendToJim("s", "x", async () => "t", fetchFn, API))).toBe(
    "denied"
  );
  const never = jest.fn();
  expect(await kindOf(sendToJim("s", "x", async () => null, never, API))).toBe(
    "denied"
  );
  expect(never).not.toHaveBeenCalled();
});

it("is waking when the server says 503 (the turn did not run)", async () => {
  const busy = jest.fn().mockResolvedValue(json(503, { error: "busy" }));
  expect(await kindOf(sendToJim("s", "x", async () => "t", busy, API))).toBe(
    "waking"
  );
});

it("is waking without calling out when the phone is offline", async () => {
  const online = jest.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  try {
    const fetchFn = jest.fn();
    expect(
      await kindOf(sendToJim("s", "x", async () => "t", fetchFn, API))
    ).toBe("waking");
    expect(fetchFn).not.toHaveBeenCalled();
  } finally {
    online.mockRestore();
  }
});

it("is uncertain when the connection drops after the message went out", async () => {
  const dropped = jest.fn().mockRejectedValue(new TypeError("Load failed"));
  expect(await kindOf(sendToJim("s", "x", async () => "t", dropped, API))).toBe(
    "uncertain"
  );
});

it("is uncertain when the reply body is cut off", async () => {
  const cut = jest.fn().mockResolvedValue({
    status: 200,
    ok: true,
    headers: headers("application/json"),
    json: async () => {
      throw new TypeError("network error");
    },
  } as unknown as Response);
  expect(await kindOf(sendToJim("s", "x", async () => "t", cut, API))).toBe(
    "uncertain"
  );
});

it.each([500, 502, 504])(
  "is uncertain on %d, which can come after the turn ran",
  async (status) => {
    const fail = jest.fn().mockResolvedValue(json(status, {}));
    expect(await kindOf(sendToJim("s", "x", async () => "t", fail, API))).toBe(
      "uncertain"
    );
  }
);

it("is uncertain on a 200 with a malformed reply", async () => {
  const odd = jest.fn().mockResolvedValue(json(200, { reply: 3 }));
  expect(await kindOf(sendToJim("s", "x", async () => "t", odd, API))).toBe(
    "uncertain"
  );
});

it("is a server error on other refusals, where the turn never ran", async () => {
  const missing = jest.fn().mockResolvedValue(json(404, {}));
  expect(await kindOf(sendToJim("s", "x", async () => "t", missing, API))).toBe(
    "server"
  );
});

it("is rejected when the message is too long or malformed", async () => {
  const token = async () => "t";
  const big = jest.fn().mockResolvedValue(json(413, {}));
  expect(await kindOf(sendToJim("s", "x", token, big, API))).toBe("rejected");
  const bad = jest.fn().mockResolvedValue(json(400, {}));
  expect(await kindOf(sendToJim("s", "x", token, bad, API))).toBe("rejected");
});

it("never calls out when Jim has no URL yet", async () => {
  expect(isJimConnected("")).toBe(false);
  expect(isJimConnected(API)).toBe(true);
  const fetchFn = jest.fn();
  expect(await kindOf(sendToJim("s", "x", async () => "t", fetchFn, ""))).toBe(
    "server"
  );
  expect(fetchFn).not.toHaveBeenCalled();
});

it("is waking when getting a token fails for a passing reason", async () => {
  const offline = jest
    .fn()
    .mockRejectedValue(
      Object.assign(new Error("net"), { code: "auth/network-request-failed" })
    );
  const fetchFn = jest.fn();
  expect(await kindOf(sendToJim("s", "x", offline, fetchFn, API))).toBe(
    "waking"
  );
  expect(fetchFn).not.toHaveBeenCalled();
});

it.each(["auth/user-token-expired", "auth/user-disabled"])(
  "is denied when getting a token fails with %s",
  async (code) => {
    const gone = jest
      .fn()
      .mockRejectedValue(Object.assign(new Error("gone"), { code }));
    expect(await kindOf(sendToJim("s", "x", gone, jest.fn(), API))).toBe(
      "denied"
    );
  }
);

it("is uncertain when it gives up on a message the server has", async () => {
  let signal: AbortSignal | undefined;
  const hang = jest.fn(
    (_url: unknown, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        signal = init?.signal ?? undefined;
        signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError"))
        );
      })
  );
  expect(
    await kindOf(sendToJim("s", "x", async () => "t", hang, API, 20))
  ).toBe("uncertain");
  expect(signal?.aborted).toBe(true);
});

it("is waking when it gives up before the message went out", async () => {
  const slowToken = () => new Promise<string>(() => {});
  const fetchFn = jest.fn();
  expect(await kindOf(sendToJim("s", "x", slowToken, fetchFn, API, 20))).toBe(
    "waking"
  );
  expect(fetchFn).not.toHaveBeenCalled();
});

it("waits as long as the server can take (Cloud Run allows 300 s)", () => {
  expect(JIM_TIMEOUT_MS).toBe(305_000);
});

it("waits at most 45 s of silence on a stream", () => {
  expect(JIM_IDLE_MS).toBe(45_000);
});

describe("streaming", () => {
  const done = { t: "done", ...ok };

  it("passes steps, deltas, the reply and saving on, then resolves with done", async () => {
    const events: JimStreamEvent[] = [];
    const fetchFn = jest
      .fn()
      .mockResolvedValue(
        ndjson([
          line({ t: "step", text: "Searching notes" }),
          line({ t: "ping" }),
          line({ t: "delta", text: "H" }),
          line({ t: "delta", text: "i" }),
          line({ t: "reply", text: "Hi" }),
          line({ t: "saving" }),
          line(done),
        ])
      );
    await expect(
      streamToJim(
        "x",
        "s",
        async () => "t",
        (e) => events.push(e),
        fetchFn,
        API
      )
    ).resolves.toEqual(ok);
    expect(events).toEqual([
      { t: "step", text: "Searching notes" },
      { t: "delta", text: "H" },
      { t: "delta", text: "i" },
      { t: "reply", text: "Hi" },
      { t: "saving" },
    ]);
  });

  it("joins lines split across chunks, multi-byte text included", async () => {
    const events: JimStreamEvent[] = [];
    const whole =
      line({ t: "delta", text: "café ✓" }) +
      line({ t: "step", text: "Reading people/a.md" }) +
      line(done);
    // Split mid-line and mid-character.
    const bytes = new TextEncoder().encode(whole);
    const cut1 = 7;
    const cut2 =
      new TextEncoder().encode(whole.slice(0, whole.indexOf("é"))).length + 1; // inside the 2-byte é
    const parts = [
      bytes.slice(0, cut1),
      bytes.slice(cut1, cut2),
      bytes.slice(cut2),
    ];
    const fetchFn = jest.fn().mockResolvedValue(ndjson(parts));
    await expect(
      streamToJim(
        "x",
        "s",
        async () => "t",
        (e) => events.push(e),
        fetchFn,
        API
      )
    ).resolves.toEqual(ok);
    expect(events).toEqual([
      { t: "delta", text: "café ✓" },
      { t: "step", text: "Reading people/a.md" },
    ]);
  });

  it("reads a last line without a trailing newline", async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(
        ndjson([line({ t: "reply", text: "Hi" }), JSON.stringify(done)])
      );
    await expect(
      streamToJim("x", "s", async () => "t", undefined, fetchFn, API)
    ).resolves.toEqual(ok);
  });

  it("is uncertain when the stream ends without done", async () => {
    const events: JimStreamEvent[] = [];
    const fetchFn = jest
      .fn()
      .mockResolvedValue(
        ndjson([line({ t: "reply", text: "Hi" }), line({ t: "saving" })])
      );
    expect(
      await kindOf(
        streamToJim(
          "x",
          "s",
          async () => "t",
          (e) => events.push(e),
          fetchFn,
          API
        )
      )
    ).toBe("uncertain");
    expect(events.map((e) => e.t)).toEqual(["reply", "saving"]);
  });

  it("is uncertain when the connection drops mid-stream (signal lost)", async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(
        ndjson([
          line({ t: "step", text: "Searching notes" }),
          new TypeError("Load failed"),
        ])
      );
    expect(
      await kindOf(
        streamToJim("x", "s", async () => "t", undefined, fetchFn, API)
      )
    ).toBe("uncertain");
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("is uncertain on a malformed line or a malformed done", async () => {
    const bad = jest
      .fn()
      .mockResolvedValue(ndjson(["{not json\n", line(done)]));
    expect(
      await kindOf(streamToJim("x", "s", async () => "t", undefined, bad, API))
    ).toBe("uncertain");
    const odd = jest
      .fn()
      .mockResolvedValue(ndjson([line({ t: "done", reply: 3 })]));
    expect(
      await kindOf(streamToJim("x", "s", async () => "t", undefined, odd, API))
    ).toBe("uncertain");
  });

  it("maps an error event: waking for a 503 before anything ran, else uncertain", async () => {
    const early = jest
      .fn()
      .mockResolvedValue(
        ndjson([
          line({ t: "ping" }),
          line({ t: "error", error: "sync", status: 503 }),
        ])
      );
    expect(
      await kindOf(
        streamToJim("x", "s", async () => "t", undefined, early, API)
      )
    ).toBe("waking");
    // A 503 after Jim started working: he may have saved something.
    const late = jest
      .fn()
      .mockResolvedValue(
        ndjson([
          line({ t: "step", text: "Saving lists/todos.md" }),
          line({ t: "error", error: "failed", status: 503 }),
        ])
      );
    expect(
      await kindOf(streamToJim("x", "s", async () => "t", undefined, late, API))
    ).toBe("uncertain");
    const failed = jest
      .fn()
      .mockResolvedValue(
        ndjson([line({ t: "error", error: "failed", status: 500 })])
      );
    expect(
      await kindOf(
        streamToJim("x", "s", async () => "t", undefined, failed, API)
      )
    ).toBe("uncertain");
  });

  it("ignores events it doesn't know", async () => {
    const events: JimStreamEvent[] = [];
    const fetchFn = jest
      .fn()
      .mockResolvedValue(
        ndjson([
          line({ t: "later", x: 1 }),
          line({ t: "step", text: 5 }),
          line(done),
        ])
      );
    await expect(
      streamToJim(
        "x",
        "s",
        async () => "t",
        (e) => events.push(e),
        fetchFn,
        API
      )
    ).resolves.toEqual(ok);
    expect(events).toEqual([]);
  });

  it("is uncertain after 45 s with no bytes, pings keep it alive", async () => {
    jest.useFakeTimers();
    try {
      // Pings every 15 s for a minute, then silence.
      let reads = 0;
      const encoder = new TextEncoder();
      const response = {
        status: 200,
        ok: true,
        headers: headers("application/x-ndjson"),
        body: {
          getReader: () => ({
            read: () =>
              reads++ < 4
                ? new Promise((resolve) =>
                    setTimeout(
                      () =>
                        resolve({
                          done: false,
                          value: encoder.encode(line({ t: "ping" })),
                        }),
                      15_000
                    )
                  )
                : new Promise(() => {}),
            cancel: async () => {},
            releaseLock: () => {},
          }),
        },
      } as unknown as Response;
      const fetchFn = jest.fn().mockResolvedValue(response);
      let kind: string | undefined;
      void kindOf(
        streamToJim("x", "s", async () => "t", undefined, fetchFn, API)
      ).then((k) => (kind = k));
      await jest.advanceTimersByTimeAsync(60_000);
      expect(kind).toBeUndefined();
      await jest.advanceTimersByTimeAsync(44_000);
      expect(kind).toBeUndefined();
      await jest.advanceTimersByTimeAsync(2_000);
      expect(kind).toBe("uncertain");
    } finally {
      jest.useRealTimers();
    }
  });

  it("still stops at the overall cap while bytes keep coming", async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(ndjson([line({ t: "ping" })], { hang: true }));
    expect(
      await kindOf(
        streamToJim("x", "s", async () => "t", undefined, fetchFn, API, 20)
      )
    ).toBe("uncertain");
  });

  it("does not count the wait for the first byte of the response as idle", async () => {
    jest.useFakeTimers();
    try {
      let respond: (r: Response) => void = () => {};
      const fetchFn = jest.fn(
        () => new Promise<Response>((resolve) => (respond = resolve))
      );
      let result: unknown;
      void streamToJim("x", "s", async () => "t", undefined, fetchFn, API).then(
        (r) => (result = r),
        (e) => (result = e)
      );
      await jest.advanceTimersByTimeAsync(100_000);
      expect(result).toBeUndefined();
      respond(ndjson([line(done)]));
      await jest.advanceTimersByTimeAsync(0);
      expect(result).toEqual(ok);
    } finally {
      jest.useRealTimers();
    }
  });
});

it("wakes the server with a GET to /api/health and ignores how it goes", async () => {
  const fetchFn = jest.fn().mockRejectedValue(new TypeError("offline"));
  wakeJim(API, fetchFn);
  const [url, init] = fetchFn.mock.calls[0];
  expect(url).toBe(`${API}/api/health`);
  expect(init.method).toBe("GET");
  expect(init.headers).toBeUndefined();
  await Promise.resolve();
  const never = jest.fn();
  wakeJim("", never);
  expect(never).not.toHaveBeenCalled();
});
