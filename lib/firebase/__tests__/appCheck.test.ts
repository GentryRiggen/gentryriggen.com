import {
  APP_CHECK_HEADER,
  EXPIRY_MARGIN_MS,
  appCheckHeaders,
  canUseAppCheck,
  getAppCheckToken,
  resetAppCheck,
  type AppCheckDeps,
  type AppCheckEnv,
} from "../appCheck";
import { firebaseConfig } from "../config";

const prodEnv: AppCheckEnv = {
  hostname: "gentryriggen.com",
  userAgent: "Mozilla/5.0 (Macintosh) Chrome/120",
  webdriver: false,
  isProduction: true,
  storage: null,
};

function okResponse(token = "AC", ttl = "3600s") {
  return { ok: true, json: async () => ({ token, ttl }) } as Response;
}

function makeDeps(overrides: Partial<AppCheckDeps> = {}) {
  let time = 1_000_000;
  const clock = { advance: (ms: number) => (time += ms) };
  const fetchImpl = jest.fn(async () => okResponse());
  const getRecaptchaToken = jest.fn(async () => "RC");
  const deps: AppCheckDeps = {
    fetchImpl: fetchImpl as unknown as typeof fetch,
    getRecaptchaToken,
    getEnv: () => prodEnv,
    now: () => time,
    ...overrides,
  };
  return { deps, fetchImpl, getRecaptchaToken, clock };
}

beforeEach(() => resetAppCheck());

describe("config", () => {
  it("carries the reCAPTCHA Enterprise site key", () => {
    expect(firebaseConfig.recaptchaSiteKey).toBe(
      "6LfTyQguAAAAAK1zNNGMj6lUpSDH-IL6rUz-y79w"
    );
  });
});

describe("getAppCheckToken", () => {
  it("exchanges a reCAPTCHA token for an App Check token", async () => {
    const { deps, fetchImpl, getRecaptchaToken } = makeDeps();
    await expect(getAppCheckToken("pageview", deps)).resolves.toBe("AC");
    expect(getRecaptchaToken).toHaveBeenCalledWith(
      firebaseConfig.recaptchaSiteKey,
      "pageview"
    );
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      `https://firebaseappcheck.googleapis.com/v1/projects/gentryriggen/apps/${firebaseConfig.appId}:exchangeRecaptchaEnterpriseToken?key=${firebaseConfig.apiKey}`
    );
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      recaptchaEnterpriseToken: "RC",
    });
  });

  it("caches the token until 5 minutes before expiry", async () => {
    const { deps, fetchImpl, clock } = makeDeps();
    await getAppCheckToken("pageview", deps);
    clock.advance(3600_000 - EXPIRY_MARGIN_MS - 1000);
    await getAppCheckToken("leaderboard", deps);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    clock.advance(2000);
    fetchImpl.mockResolvedValueOnce(okResponse("AC2"));
    await expect(getAppCheckToken("leaderboard", deps)).resolves.toBe("AC2");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("shares one request between concurrent callers", async () => {
    const { deps, fetchImpl, getRecaptchaToken } = makeDeps();
    const results = await Promise.all([
      getAppCheckToken("pageview", deps),
      getAppCheckToken("game_event", deps),
      getAppCheckToken("leaderboard", deps),
    ]);
    expect(results).toEqual(["AC", "AC", "AC"]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(getRecaptchaToken).toHaveBeenCalledTimes(1);
  });

  it("cachedOnly returns a cached token but never starts a request", async () => {
    const { deps, fetchImpl } = makeDeps();
    await expect(
      getAppCheckToken("pageview", { ...deps, cachedOnly: true })
    ).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
    await getAppCheckToken("pageview", deps);
    await expect(
      getAppCheckToken("pageview", { ...deps, cachedOnly: true })
    ).resolves.toBe("AC");
  });

  describe("fails open", () => {
    it("when reCAPTCHA is blocked", async () => {
      const { deps, fetchImpl } = makeDeps({
        getRecaptchaToken: async () => {
          throw new Error("blocked");
        },
      });
      await expect(getAppCheckToken("pageview", deps)).resolves.toBeNull();
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it("when offline", async () => {
      const { deps } = makeDeps({
        fetchImpl: (async () => {
          throw new TypeError("offline");
        }) as unknown as typeof fetch,
      });
      await expect(getAppCheckToken("pageview", deps)).resolves.toBeNull();
    });

    it("on a non-200", async () => {
      const { deps } = makeDeps({
        fetchImpl: (async () =>
          ({ ok: false, status: 403 }) as Response) as unknown as typeof fetch,
      });
      await expect(getAppCheckToken("pageview", deps)).resolves.toBeNull();
    });

    it("on a malformed reply", async () => {
      const { deps } = makeDeps({
        fetchImpl: (async () =>
          ({
            ok: true,
            json: async () => ({ token: "x" }),
          }) as Response) as unknown as typeof fetch,
      });
      await expect(getAppCheckToken("pageview", deps)).resolves.toBeNull();
    });

    it("on a timeout, then recovers on the next call", async () => {
      const { deps } = makeDeps({
        getRecaptchaToken: () => new Promise<string>(() => {}),
        timeoutMs: 10,
      });
      await expect(getAppCheckToken("pageview", deps)).resolves.toBeNull();
      const healthy = makeDeps();
      await expect(getAppCheckToken("pageview", healthy.deps)).resolves.toBe(
        "AC"
      );
    });
  });

  describe("never loads anything", () => {
    const blocked: Array<[string, Partial<AppCheckEnv>]> = [
      ["in dev and e2e builds", { isProduction: false }],
      ["on localhost", { hostname: "localhost" }],
      ["for bots", { userAgent: "Googlebot/2.1" }],
      ["for webdriver browsers", { webdriver: true }],
      [
        "for the signed-in owner",
        {
          storage: {
            getItem: () => "1",
            setItem: () => {},
          },
        },
      ],
    ];
    it.each(blocked)("%s", async (_name, patch) => {
      const { deps, fetchImpl, getRecaptchaToken } = makeDeps({
        getEnv: () => ({ ...prodEnv, ...patch }),
      });
      await expect(getAppCheckToken("pageview", deps)).resolves.toBeNull();
      expect(getRecaptchaToken).not.toHaveBeenCalled();
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it("on the server", () => {
      expect(canUseAppCheck(null)).toBe(false);
    });

    it("without a site key", async () => {
      const { deps, getRecaptchaToken } = makeDeps({
        config: { ...firebaseConfig, recaptchaSiteKey: "" },
      });
      await expect(getAppCheckToken("pageview", deps)).resolves.toBeNull();
      expect(getRecaptchaToken).not.toHaveBeenCalled();
    });

    it("injects no script under jest (not production)", async () => {
      await expect(getAppCheckToken("pageview")).resolves.toBeNull();
      expect(document.querySelector("script[src*='recaptcha']")).toBeNull();
    });
  });
});

describe("appCheckHeaders", () => {
  it("carries the token header, or nothing", async () => {
    const { deps } = makeDeps();
    await expect(appCheckHeaders("pageview", deps)).resolves.toEqual({
      [APP_CHECK_HEADER]: "AC",
    });
    resetAppCheck();
    await expect(
      appCheckHeaders("pageview", { ...deps, getEnv: () => null })
    ).resolves.toEqual({});
  });
});
