import { JimError } from "../api";
import { getPushSettings, putPushSettings } from "../pushSettings";

const API = "https://jim.example.test";

const SETTINGS = {
  kinds: [
    { id: "morning", label: "Morning brief", on: true },
    { id: "evening", label: "Evening wrap", on: false },
  ],
  eveningTime: "21:00",
  lessonTime: "12:00",
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

describe("push settings client", () => {
  it("gets the settings", async () => {
    const fetchFn = jest.fn().mockResolvedValue(res(200, SETTINGS));
    const got = await getPushSettings(async () => "t1", fetchFn, API);
    expect(got).toEqual(SETTINGS);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(`${API}/api/push/settings`);
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer t1");
  });

  it("puts only the patch", async () => {
    const fetchFn = jest.fn().mockResolvedValue(res(200, SETTINGS));
    await putPushSettings(
      { kinds: { evening: true } },
      async () => "t",
      fetchFn,
      API
    );
    const [, init] = fetchFn.mock.calls[0];
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ kinds: { evening: true } });
  });

  it("surfaces the server's words on a 400", async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(
        res(400, { error: "Evening time must be 17:00 to 21:45." })
      );
    await expect(
      putPushSettings({ eveningTime: "23:00" }, async () => "t", fetchFn, API)
    ).rejects.toThrow("Evening time must be 17:00 to 21:45.");
  });

  it("maps a 503 to a server error", async () => {
    const fetchFn = jest.fn().mockResolvedValue(res(503, { error: "busy" }));
    await expect(
      getPushSettings(async () => "t", fetchFn, API)
    ).rejects.toMatchObject({
      kind: "server",
    });
    await expect(
      getPushSettings(async () => "t", fetchFn, API)
    ).rejects.toBeInstanceOf(JimError);
  });

  it("refreshes the token once after a 401", async () => {
    const getToken = jest
      .fn()
      .mockResolvedValueOnce("old")
      .mockResolvedValueOnce("new");
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(res(401))
      .mockResolvedValueOnce(res(200, SETTINGS));
    await getPushSettings(getToken, fetchFn, API);
    expect(getToken).toHaveBeenNthCalledWith(2, true);
  });
});
