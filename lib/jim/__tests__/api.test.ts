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

it("is waking when the network fails or the server says 503", async () => {
  const token = async () => "t";
  const offline = jest.fn().mockRejectedValue(new TypeError("Load failed"));
  expect(await kindOf(sendToJim("s", "x", token, offline, API))).toBe("waking");
  const busy = jest.fn().mockResolvedValue(json(503, { error: "busy" }));
  expect(await kindOf(sendToJim("s", "x", token, busy, API))).toBe("waking");
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

it("gives up as waking when the server takes too long", async () => {
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
  ).toBe("waking");
  expect(signal?.aborted).toBe(true);
});

it("waits about 90 seconds by default", () => {
  expect(JIM_TIMEOUT_MS).toBe(90_000);
});
