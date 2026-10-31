import { isJimConnected, JIM_TIMEOUT_MS, JimError, sendToJim } from "../api";

const API = "https://jim.example.test";

/** jsdom has no Response, so fake the part sendToJim reads. */
function json(status: number, body: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response;
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
    json: async () => {
      throw new TypeError("network error");
    },
  } as unknown as Response);
  expect(await kindOf(sendToJim("s", "x", async () => "t", cut, API))).toBe(
    "uncertain"
  );
});

it("is a server error on 500 or a malformed reply", async () => {
  const token = async () => "t";
  const boom = jest.fn().mockResolvedValue(json(500, {}));
  expect(await kindOf(sendToJim("s", "x", token, boom, API))).toBe("server");
  const odd = jest.fn().mockResolvedValue(json(200, { reply: 3 }));
  expect(await kindOf(sendToJim("s", "x", token, odd, API))).toBe("server");
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
