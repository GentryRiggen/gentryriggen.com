import { JimError } from "../api";
import { RETRO_MESSAGES, saveRetro } from "../retro";

const API = "https://jim.example.test";
const BODY = {
  kind: "evening" as const,
  day: "2026-10-31",
  answers: ["A calm walk.", "", "Start earlier."],
};

function res(status: number, body?: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => {
      if (body === undefined) throw new Error("no body");
      return body;
    },
  } as Response;
}

async function messageOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (err) {
    if (err instanceof Error) return err.message;
  }
  throw new Error("expected a refusal");
}

describe("saveRetro", () => {
  it("posts the kind, day and three answers", async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(res(200, { ok: true, sha: "abc1234" }));
    const got = await saveRetro(async () => "t1", API, BODY, fetchFn);
    expect(got).toEqual({ sha: "abc1234" });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(`${API}/api/retro`);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer t1");
    expect(JSON.parse(init.body)).toEqual(BODY);
  });

  it("an unchanged file has no sha", async () => {
    const fetchFn = jest.fn().mockResolvedValue(res(200, { ok: true }));
    expect(await saveRetro(async () => "t", API, BODY, fetchFn)).toEqual({
      sha: null,
    });
  });

  it.each([400, 503])(
    "shows the server's own words on a %i",
    async (status) => {
      const fetchFn = jest
        .fn()
        .mockResolvedValue(res(status, { error: "That day has passed." }));
      expect(
        await messageOf(saveRetro(async () => "t", API, BODY, fetchFn))
      ).toBe("That day has passed.");
    }
  );

  it("a 503 without words says try again", async () => {
    const fetchFn = jest.fn().mockResolvedValue(res(503));
    expect(
      await messageOf(saveRetro(async () => "t", API, BODY, fetchFn))
    ).toBe(RETRO_MESSAGES.failed);
  });

  it("a 404 (an older server) says the retro isn't available yet", async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(res(404, { error: "not found" }));
    expect(
      await messageOf(saveRetro(async () => "t", API, BODY, fetchFn))
    ).toBe("Your retro isn't available yet.");
  });

  it("a refused sign-in says so", async () => {
    const fetchFn = jest.fn().mockResolvedValue(res(403));
    expect(
      await messageOf(saveRetro(async () => "t", API, BODY, fetchFn))
    ).toBe(RETRO_MESSAGES.denied);
  });

  it("no connection says try again, never a JimError", async () => {
    const fetchFn = jest.fn().mockRejectedValue(new TypeError("offline"));
    const promise = saveRetro(async () => "t", API, BODY, fetchFn);
    await expect(promise).rejects.not.toBeInstanceOf(JimError);
    expect(await messageOf(promise)).toBe(RETRO_MESSAGES.failed);
  });
});
