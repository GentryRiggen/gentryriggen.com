import { AUTH_STORAGE_KEY, getIdToken, resetAuthCache } from "../auth";

const config = {
  apiKey: "KEY",
  authDomain: "x",
  projectId: "proj",
  appId: "x",
};

function makeStorage(initial?: string) {
  const data = new Map<string, string>();
  if (initial) data.set(AUTH_STORAGE_KEY, initial);
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

function reply(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

const signUpReply = {
  idToken: "id-1",
  refreshToken: "refresh-1",
  localId: "uid-1",
  expiresIn: "3600",
};

beforeEach(() => resetAuthCache());

describe("getIdToken", () => {
  it("signs up anonymously, stores the refresh token, then caches", async () => {
    const storage = makeStorage();
    const fetchImpl = jest.fn().mockResolvedValue(reply(200, signUpReply));
    const deps = { config, fetchImpl, storage, now: () => 1000 };

    expect(await getIdToken(deps)).toEqual({ uid: "uid-1", idToken: "id-1" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(
      "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=KEY"
    );
    expect(JSON.parse(init.body)).toEqual({ returnSecureToken: true });
    expect(JSON.parse(storage.data.get(AUTH_STORAGE_KEY) ?? "")).toEqual({
      uid: "uid-1",
      refreshToken: "refresh-1",
    });

    expect(await getIdToken(deps)).toEqual({ uid: "uid-1", idToken: "id-1" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("refreshes an expired token with the stored refresh token", async () => {
    const storage = makeStorage();
    let now = 0;
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(reply(200, signUpReply))
      .mockResolvedValueOnce(
        reply(200, {
          id_token: "id-2",
          refresh_token: "refresh-2",
          user_id: "uid-1",
          expires_in: "3600",
        })
      );
    const deps = { config, fetchImpl, storage, now: () => now };
    await getIdToken(deps);

    now = 3600 * 1000;
    expect(await getIdToken(deps)).toEqual({ uid: "uid-1", idToken: "id-2" });
    const [url, init] = fetchImpl.mock.calls[1];
    expect(url).toBe("https://securetoken.googleapis.com/v1/token?key=KEY");
    expect(String(init.body)).toBe(
      "grant_type=refresh_token&refresh_token=refresh-1"
    );
    expect(
      JSON.parse(storage.data.get(AUTH_STORAGE_KEY) ?? "").refreshToken
    ).toBe("refresh-2");
  });

  it("refreshes from storage after a reload (no in-memory token)", async () => {
    const storage = makeStorage(
      JSON.stringify({ uid: "uid-9", refreshToken: "r-9" })
    );
    const fetchImpl = jest.fn().mockResolvedValue(
      reply(200, {
        id_token: "id-9",
        refresh_token: "r-9b",
        user_id: "uid-9",
        expires_in: "3600",
      })
    );
    expect(
      await getIdToken({ config, fetchImpl, storage, now: () => 0 })
    ).toEqual({ uid: "uid-9", idToken: "id-9" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("signs up again when the refresh token is rejected (400)", async () => {
    const storage = makeStorage(
      JSON.stringify({ uid: "old", refreshToken: "dead" })
    );
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(
        reply(400, { error: { message: "TOKEN_EXPIRED" } })
      )
      .mockResolvedValueOnce(reply(200, signUpReply));
    expect(
      await getIdToken({ config, fetchImpl, storage, now: () => 0 })
    ).toEqual({ uid: "uid-1", idToken: "id-1" });
  });

  it("ignores corrupt stored data", async () => {
    const storage = makeStorage("not json");
    const fetchImpl = jest.fn().mockResolvedValue(reply(200, signUpReply));
    expect(
      await getIdToken({ config, fetchImpl, storage, now: () => 0 })
    ).not.toBeNull();
    expect(fetchImpl.mock.calls[0][0]).toContain("accounts:signUp");
  });

  it("returns null when sign-up is refused (Anonymous disabled)", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(reply(400, { error: { message: "ADMIN_ONLY" } }));
    expect(
      await getIdToken({ config, fetchImpl, storage: makeStorage() })
    ).toBeNull();
  });

  it("returns null on a malformed sign-up response", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(reply(200, { idToken: "x" }));
    expect(
      await getIdToken({ config, fetchImpl, storage: makeStorage() })
    ).toBeNull();
  });

  it("returns null when fetch throws", async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error("offline"));
    expect(
      await getIdToken({ config, fetchImpl, storage: makeStorage() })
    ).toBeNull();
  });

  it("returns null on a refresh server error without signing up", async () => {
    const storage = makeStorage(
      JSON.stringify({ uid: "u", refreshToken: "r" })
    );
    const fetchImpl = jest.fn().mockResolvedValue(reply(503, {}));
    expect(await getIdToken({ config, fetchImpl, storage })).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("returns null without touching the network when unconfigured", async () => {
    const fetchImpl = jest.fn();
    expect(
      await getIdToken({
        config: { ...config, apiKey: "" },
        fetchImpl,
        storage: makeStorage(),
      })
    ).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("shares one request between concurrent callers", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(reply(200, signUpReply));
    const deps = { config, fetchImpl, storage: makeStorage(), now: () => 0 };
    const [a, b] = await Promise.all([getIdToken(deps), getIdToken(deps)]);
    expect(a).toEqual(b);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
