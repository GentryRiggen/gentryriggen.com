import { JimError } from "../api";
import {
  addReminder,
  doneReminder,
  getReminder,
  listReminders,
  patchReminder,
} from "../reminders";

const API = "https://jim.example.test";
const ID = "abcdef012345";

const REMINDER = {
  id: ID,
  at: "2026-11-01T15:30:00-07:00",
  text: "Water the plants",
  created: "2026-11-01T10:00:00-07:00",
  sent: null,
  rev: 0,
  when: "Today 3:30 PM",
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

async function kindOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (err) {
    if (err instanceof JimError) return err.kind;
    throw err;
  }
  throw new Error("expected a JimError");
}

describe("reminders client", () => {
  it("lists reminders with the bearer token", async () => {
    const getToken = jest.fn().mockResolvedValue("t1");
    const fetchFn = jest
      .fn()
      .mockResolvedValue(res(200, { reminders: [REMINDER, { id: 5 }] }));
    const list = await listReminders(getToken, fetchFn, API);
    expect(list).toEqual([REMINDER]);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(`${API}/api/reminders`);
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer t1");
  });

  it("posts a new reminder", async () => {
    const fetchFn = jest.fn().mockResolvedValue(res(201, REMINDER));
    const made = await addReminder(
      "2026-11-01T15:30",
      "Water the plants",
      async () => "t",
      fetchFn,
      API
    );
    expect(made.id).toBe(ID);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(`${API}/api/reminders`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      at: "2026-11-01T15:30",
      text: "Water the plants",
    });
  });

  it("surfaces the server's words on a 400", async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(res(400, { error: "That time has passed." }));
    await expect(
      addReminder("2026-01-01T00:00", "x", async () => "t", fetchFn, API)
    ).rejects.toThrow("That time has passed.");
  });

  it("maps a 503 to a server error", async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(res(503, { error: "Couldn't set the timer." }));
    expect(
      await kindOf(
        addReminder("2026-11-02T09:00", "x", async () => "t", fetchFn, API)
      )
    ).toBe("server");
  });

  it("patches with exactly the body given", async () => {
    const fetchFn = jest.fn().mockResolvedValue(res(200, REMINDER));
    await patchReminder(ID, { snooze: "10m" }, async () => "t", fetchFn, API);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(`${API}/api/reminders/${ID}`);
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ snooze: "10m" });
  });

  it("deletes for Done and treats a 404 as done", async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(res(204))
      .mockResolvedValueOnce(res(404, { error: "not found" }));
    await doneReminder(ID, async () => "t", fetchFn, API);
    await doneReminder(ID, async () => "t", fetchFn, API);
    expect(fetchFn.mock.calls[0][1].method).toBe("DELETE");
  });

  it("gets one reminder, or null when it is gone", async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(res(200, REMINDER))
      .mockResolvedValueOnce(res(404, { error: "not found" }));
    expect((await getReminder(ID, async () => "t", fetchFn, API))?.text).toBe(
      "Water the plants"
    );
    expect(await getReminder(ID, async () => "t", fetchFn, API)).toBeNull();
  });

  it("refreshes the token once after a 401", async () => {
    const getToken = jest
      .fn()
      .mockResolvedValueOnce("old")
      .mockResolvedValueOnce("new");
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(res(401))
      .mockResolvedValueOnce(res(200, { reminders: [] }));
    await listReminders(getToken, fetchFn, API);
    expect(getToken).toHaveBeenNthCalledWith(1, false);
    expect(getToken).toHaveBeenNthCalledWith(2, true);
    expect(fetchFn.mock.calls[1][1].headers.Authorization).toBe("Bearer new");
  });

  it("is denied after a second 401", async () => {
    const fetchFn = jest.fn().mockResolvedValue(res(401));
    expect(await kindOf(listReminders(async () => "t", fetchFn, API))).toBe(
      "denied"
    );
  });
});
