import { JimError } from "../api";
import { fetchSpeech } from "../voice";

const API = "https://jim.example.test";

function audio(status: number, bytes = 10): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    blob: async () => ({ size: bytes, type: "audio/mpeg" }) as Blob,
    json: async () => ({ error: "x" }),
  } as unknown as Response;
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

describe("fetchSpeech", () => {
  it("posts the text with the bearer token and returns the audio", async () => {
    const getToken = jest.fn().mockResolvedValue("t1");
    const fetchFn = jest.fn().mockResolvedValue(audio(200));
    const blob = await fetchSpeech(
      " Hello there. ",
      undefined,
      getToken,
      API,
      undefined,
      fetchFn
    );
    expect(blob.size).toBe(10);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(`${API}/api/speak`);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer t1");
    // No voice: the server reads in the active persona's.
    expect(JSON.parse(init.body)).toEqual({ text: "Hello there." });
  });

  it("sends a voice when given one", async () => {
    const fetchFn = jest.fn().mockResolvedValue(audio(200));
    await fetchSpeech(
      "Hi.",
      "Charon",
      jest.fn().mockResolvedValue("t"),
      API,
      undefined,
      fetchFn
    );
    expect(JSON.parse(fetchFn.mock.calls[0][1].body)).toEqual({
      text: "Hi.",
      voice: "Charon",
    });
  });

  it("refreshes the token once after a 401", async () => {
    const getToken = jest
      .fn()
      .mockResolvedValueOnce("old")
      .mockResolvedValueOnce("new");
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(audio(401))
      .mockResolvedValueOnce(audio(200));
    await fetchSpeech("Hi.", undefined, getToken, API, undefined, fetchFn);
    expect(getToken).toHaveBeenLastCalledWith(true);
    expect(fetchFn.mock.calls[1][1].headers.Authorization).toBe("Bearer new");
  });

  it.each([
    [400, "rejected"],
    [502, "server"],
    [503, "waking"],
    [403, "denied"],
  ])("a %i is %s", async (status, kind) => {
    const fetchFn = jest.fn().mockResolvedValue(audio(status));
    await expect(
      kindOf(
        fetchSpeech(
          "Hi.",
          undefined,
          jest.fn().mockResolvedValue("t"),
          API,
          undefined,
          fetchFn
        )
      )
    ).resolves.toBe(kind);
  });

  it("refuses an empty body, empty text and text over 1500 characters", async () => {
    const getToken = jest.fn().mockResolvedValue("t");
    const fetchFn = jest.fn().mockResolvedValue(audio(200, 0));
    await expect(
      kindOf(fetchSpeech("Hi.", undefined, getToken, API, undefined, fetchFn))
    ).resolves.toBe("server");
    fetchFn.mockClear();
    await expect(
      kindOf(fetchSpeech("  ", undefined, getToken, API, undefined, fetchFn))
    ).resolves.toBe("rejected");
    await expect(
      kindOf(
        fetchSpeech(
          "a".repeat(1501),
          undefined,
          getToken,
          API,
          undefined,
          fetchFn
        )
      )
    ).resolves.toBe("rejected");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("gives up when its signal aborts", async () => {
    const controller = new AbortController();
    const fetchFn = jest.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new Error("aborted"))
          );
        })
    );
    const pending = fetchSpeech(
      "Hi.",
      undefined,
      jest.fn().mockResolvedValue("t"),
      API,
      controller.signal,
      fetchFn as unknown as typeof fetch
    );
    await Promise.resolve();
    controller.abort();
    await expect(kindOf(pending)).resolves.toBe("waking");
  });
});
