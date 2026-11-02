import { JimError, onSignInRefused, revokeSessions } from "../api";

const API = "https://jim.example.test";

function res(status: number, body?: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response;
}

describe("revokeSessions", () => {
  it("posts to the revoke endpoint with the token and resolves on 204", async () => {
    const fetchFn = jest.fn().mockResolvedValue(res(204));
    await revokeSessions(async () => "t1", fetchFn, API);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(`${API}/api/auth/revoke`);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer t1");
  });

  it("throws a JimError on a 503, without ending the session", async () => {
    const listener = jest.fn();
    const stop = onSignInRefused(listener);
    const fetchFn = jest.fn().mockResolvedValue(
      res(503, {
        error: "Couldn't sign out everywhere. Try again in a minute.",
      })
    );
    await expect(
      revokeSessions(async () => "t", fetchFn, API)
    ).rejects.toBeInstanceOf(JimError);
    await Promise.resolve();
    expect(listener).not.toHaveBeenCalled();
    stop();
  });

  it("throws on a 200 too: only 204 means every session ended", async () => {
    const fetchFn = jest.fn().mockResolvedValue(res(200, {}));
    await expect(
      revokeSessions(async () => "t", fetchFn, API)
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
      .mockResolvedValueOnce(res(204));
    await revokeSessions(getToken, fetchFn, API);
    expect(getToken).toHaveBeenNthCalledWith(2, true);
    expect(fetchFn.mock.calls[1][1].headers.Authorization).toBe("Bearer new");
  });

  it("a refused sign-in is denied and ends the session", async () => {
    const listener = jest.fn();
    const stop = onSignInRefused(listener);
    const fetchFn = jest.fn().mockResolvedValue(res(401));
    const err = await revokeSessions(async () => "t", fetchFn, API).catch(
      (e: unknown) => e
    );
    expect(err).toBeInstanceOf(JimError);
    expect((err as JimError).kind).toBe("denied");
    await Promise.resolve();
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
  });

  it("a network failure is a JimError", async () => {
    const fetchFn = jest.fn().mockRejectedValue(new TypeError("offline"));
    await expect(
      revokeSessions(async () => "t", fetchFn, API)
    ).rejects.toBeInstanceOf(JimError);
  });
});
