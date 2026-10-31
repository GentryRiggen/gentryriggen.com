import { boardSettingsUrl, fetchBoardHidden } from "../boardSettings";

const config = {
  apiKey: "KEY",
  authDomain: "x",
  projectId: "proj",
  appId: "x",
};
const noAppCheck = async () => ({});

const reply = (status: number, json?: unknown) =>
  jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => json,
  });

function read(fetchImpl: jest.Mock) {
  return fetchBoardHidden("plane", {
    config,
    fetchImpl: fetchImpl as unknown as typeof fetch,
    getAppCheckHeaders: noAppCheck,
  });
}

describe("fetchBoardHidden", () => {
  it("GETs boardSettings/plane without auth", async () => {
    const fetchImpl = reply(200, {
      fields: { hidden: { booleanValue: false } },
    });
    await read(fetchImpl);
    expect(boardSettingsUrl(config, "plane")).toBe(
      "https://firestore.googleapis.com/v1/projects/proj/databases/(default)/documents/boardSettings/plane?key=KEY"
    );
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(boardSettingsUrl(config, "plane"));
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBeUndefined();
  });

  it("returns the stored flag", async () => {
    expect(
      await read(reply(200, { fields: { hidden: { booleanValue: false } } }))
    ).toBe(false);
    expect(
      await read(reply(200, { fields: { hidden: { booleanValue: true } } }))
    ).toBe(true);
  });

  it("hides the board when the doc is missing, bad or unreadable", async () => {
    expect(await read(reply(404))).toBe(true);
    expect(await read(reply(500))).toBe(true);
    expect(await read(reply(200, { fields: {} }))).toBe(true);
    expect(
      await read(reply(200, { fields: { hidden: { stringValue: "no" } } }))
    ).toBe(true);
    expect(await read(reply(200, null))).toBe(true);
    expect(await read(jest.fn().mockRejectedValue(new Error("offline")))).toBe(
      true
    );
  });

  it("hides the board when Firebase is not configured", async () => {
    const fetchImpl = reply(200, {
      fields: { hidden: { booleanValue: false } },
    });
    expect(
      await fetchBoardHidden("plane", {
        config: { ...config, apiKey: "" },
        fetchImpl: fetchImpl as unknown as typeof fetch,
        getAppCheckHeaders: noAppCheck,
      })
    ).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
