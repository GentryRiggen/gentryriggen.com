import { JimError } from "../api";
import {
  fetchPersonas,
  loadPersonaName,
  parsePersonas,
  PERSONA_MESSAGES,
  savePersonaName,
  switchPersona,
} from "../personas";

const API = "https://jim.example.test";
const token = () => jest.fn().mockResolvedValue("t1");

function json(status: number, body: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response;
}

const LIST = {
  active: "rook",
  personas: [
    {
      id: "vega",
      name: "Vega",
      summary: "The starship's AI.",
      examples: ["Course plotted, Captain."],
      voice: "Aoede",
    },
    {
      id: "rook",
      name: "Rook",
      summary: "Dry and brief.",
      examples: ["Noted."],
      voice: "Charon",
    },
  ],
};

describe("parsePersonas", () => {
  it("puts the active persona first", () => {
    const list = parsePersonas(LIST);
    expect(list?.personas.map((p) => p.id)).toEqual(["rook", "vega"]);
    expect(list?.active).toBe("rook");
    expect(list?.stale).toBe(false);
  });

  it("drops malformed entries and fills gaps", () => {
    const list = parsePersonas({
      active: "a",
      stale: true,
      personas: [
        { id: "a", examples: ["x", 3, ""] },
        { name: "no id" },
        "nonsense",
      ],
    });
    expect(list).toEqual({
      active: "a",
      stale: true,
      personas: [
        { id: "a", name: "a", summary: "", examples: ["x"], voice: null },
      ],
    });
  });

  it("refuses a body with no list", () => {
    expect(parsePersonas({ active: "a" })).toBeNull();
    expect(parsePersonas(null)).toBeNull();
  });
});

describe("fetchPersonas", () => {
  it("posts {} with the bearer token", async () => {
    const fetchFn = jest.fn().mockResolvedValue(json(200, LIST));
    const list = await fetchPersonas(token(), API, fetchFn);
    expect(list.personas).toHaveLength(2);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(`${API}/api/personas`);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer t1");
    expect(JSON.parse(init.body)).toEqual({});
  });

  it("throws on a failure or a bad body", async () => {
    await expect(
      fetchPersonas(token(), API, jest.fn().mockResolvedValue(json(500, {})))
    ).rejects.toBeInstanceOf(JimError);
    await expect(
      fetchPersonas(token(), API, jest.fn().mockResolvedValue(json(200, {})))
    ).rejects.toBeInstanceOf(JimError);
  });
});

describe("switchPersona", () => {
  it("posts the id and returns the new active persona", async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(json(200, { ok: true, active: "rook" }));
    await expect(switchPersona("rook", token(), API, fetchFn)).resolves.toEqual(
      { ok: true, active: "rook" }
    );
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(`${API}/api/persona`);
    expect(JSON.parse(init.body)).toEqual({ id: "rook" });
  });

  it("passes on the server's 503 message", async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(json(503, { error: "Jim is mid-sync. Try again." }));
    await expect(switchPersona("rook", token(), API, fetchFn)).resolves.toEqual(
      { ok: false, message: "Jim is mid-sync. Try again." }
    );
  });

  it.each([
    [404, PERSONA_MESSAGES.unknown],
    [503, PERSONA_MESSAGES.busy],
    [500, PERSONA_MESSAGES.failed],
    [403, PERSONA_MESSAGES.denied],
  ])("a %i says so", async (status, message) => {
    const fetchFn = jest.fn().mockResolvedValue(json(status, null));
    await expect(switchPersona("x", token(), API, fetchFn)).resolves.toEqual({
      ok: false,
      message,
    });
  });

  it("says it couldn't reach Jim when the call never lands", async () => {
    const fetchFn = jest.fn().mockRejectedValue(new TypeError("offline"));
    await expect(switchPersona("x", token(), API, fetchFn)).resolves.toEqual({
      ok: false,
      message: PERSONA_MESSAGES.unreachable,
    });
  });
});

describe("persona name", () => {
  beforeEach(() => window.localStorage.clear());

  it("is remembered on this device", () => {
    expect(loadPersonaName()).toBeNull();
    savePersonaName("Vega");
    expect(loadPersonaName()).toBe("Vega");
  });
});
