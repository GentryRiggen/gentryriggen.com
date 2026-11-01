import { fetchBriefScript } from "../brief";

const API = "https://jim.example.test";

function res(status: number, body: unknown): Response {
  return { status, ok: status < 300, json: async () => body } as Response;
}

describe("fetchBriefScript", () => {
  it("posts an empty body and returns the script", async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(
        res(200, { day: "2026-11-01", text: "Good morning." })
      );
    const got = await fetchBriefScript(async () => "t", {}, fetchFn, API);
    expect(got).toEqual({ day: "2026-11-01", text: "Good morning." });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(`${API}/api/brief/script`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({});
  });

  it("asks for a rewrite with fresh", async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(res(200, { day: "d", text: "t" }));
    await fetchBriefScript(async () => "t", { fresh: true }, fetchFn, API);
    expect(JSON.parse(fetchFn.mock.calls[0][1].body)).toEqual({ fresh: true });
  });

  it("surfaces the daily limit text on a 429", async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(res(429, { error: "Rewritten enough for today." }));
    await expect(
      fetchBriefScript(async () => "t", { fresh: true }, fetchFn, API)
    ).rejects.toThrow("Rewritten enough for today.");
  });

  it("is a server error on a 5xx or a malformed body", async () => {
    await expect(
      fetchBriefScript(
        async () => "t",
        {},
        jest.fn().mockResolvedValue(res(503, {})),
        API
      )
    ).rejects.toMatchObject({ kind: "server" });
    await expect(
      fetchBriefScript(
        async () => "t",
        {},
        jest.fn().mockResolvedValue(res(200, { day: 1 })),
        API
      )
    ).rejects.toMatchObject({ kind: "server" });
  });
});
