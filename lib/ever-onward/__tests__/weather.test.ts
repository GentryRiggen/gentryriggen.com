import { CLEAR_WEATHER, type Weather } from "../sky";
import {
  FRESH_MS,
  STALE_MS,
  WEATHER_CACHE_KEY,
  WEATHER_TOGGLE_KEY,
  initialWeather,
  readWeatherEnabled,
  resolveWeather,
  writeWeatherEnabled,
} from "../weather";

const NOW = 1_800_000_000_000;
const RAIN: Weather = { kind: "rain", heat: "mild" };
const SNOW: Weather = { kind: "snow", heat: "cold" };

function makeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    data,
  };
}

function cacheOf(weather: Weather, ageMs: number) {
  return JSON.stringify({ weather, at: NOW - ageMs });
}

function geoAt(latitude: number, longitude: number) {
  return {
    getCurrentPosition: jest.fn((ok: PositionCallback) =>
      ok({ coords: { latitude, longitude } } as GeolocationPosition)
    ),
  };
}

const deniedGeo = {
  getCurrentPosition: jest.fn(
    (_ok: PositionCallback, fail?: PositionErrorCallback | null) =>
      fail?.({ code: 1, message: "denied" } as GeolocationPositionError)
  ),
};

function replyWith(body: unknown, ok = true) {
  return jest.fn().mockResolvedValue({ ok, json: async () => body });
}

const rainReply = { current: { weather_code: 63, temperature_2m: 12 } };

describe("resolveWeather", () => {
  it("rounds coordinates to one decimal before the request", async () => {
    const fetchFn = replyWith(rainReply);
    const weather = await resolveWeather({
      geolocation: geoAt(40.76078, -111.89105),
      fetchFn,
      storage: makeStorage(),
      now: NOW,
    });
    expect(weather).toEqual(RAIN);
    const url = String(fetchFn.mock.calls[0][0]);
    expect(url).toContain("https://api.open-meteo.com/v1/forecast?");
    expect(url).toContain("latitude=40.8&");
    expect(url).toContain("longitude=-111.9&");
    expect(url).not.toContain("40.76");
    expect(url).not.toContain("111.89");
  });

  it("never stores coordinates, only the weather and a time", async () => {
    const storage = makeStorage();
    await resolveWeather({
      geolocation: geoAt(40.76078, -111.89105),
      fetchFn: replyWith(rainReply),
      storage,
      now: NOW,
    });
    const stored = [...storage.data.values()].join(" ");
    expect(stored).not.toMatch(/40\.|111\./);
    expect(JSON.parse(storage.data.get(WEATHER_CACHE_KEY) ?? "")).toEqual({
      weather: RAIN,
      at: NOW,
    });
  });

  it("uses a fresh cache without asking for a position", async () => {
    const geolocation = geoAt(1, 1);
    const fetchFn = replyWith(rainReply);
    const weather = await resolveWeather({
      geolocation,
      fetchFn,
      storage: makeStorage({
        [WEATHER_CACHE_KEY]: cacheOf(SNOW, FRESH_MS - 1000),
      }),
      now: NOW,
    });
    expect(weather).toEqual(SNOW);
    expect(geolocation.getCurrentPosition).not.toHaveBeenCalled();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("is clear when permission is denied", async () => {
    const fetchFn = replyWith(rainReply);
    expect(
      await resolveWeather({
        geolocation: deniedGeo,
        fetchFn,
        storage: makeStorage(),
        now: NOW,
      })
    ).toEqual(CLEAR_WEATHER);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("is clear without geolocation support", async () => {
    expect(
      await resolveWeather({
        geolocation: null,
        fetchFn: replyWith(rainReply),
        storage: makeStorage(),
        now: NOW,
      })
    ).toEqual(CLEAR_WEATHER);
  });

  it.each([
    ["the network fails", jest.fn().mockRejectedValue(new Error("offline"))],
    ["the server errors", replyWith({}, false)],
    ["the reply is junk", replyWith({ nope: true })],
  ])("is clear when %s", async (_name, fetchFn) => {
    expect(
      await resolveWeather({
        geolocation: geoAt(1, 1),
        fetchFn,
        storage: makeStorage(),
        now: NOW,
      })
    ).toEqual(CLEAR_WEATHER);
  });

  it("falls back to weather under 3 hours old when the lookup fails", async () => {
    expect(
      await resolveWeather({
        geolocation: deniedGeo,
        storage: makeStorage({
          [WEATHER_CACHE_KEY]: cacheOf(SNOW, STALE_MS - 1000),
        }),
        now: NOW,
      })
    ).toEqual(SNOW);
  });

  it("ignores weather over 3 hours old", async () => {
    expect(
      await resolveWeather({
        geolocation: deniedGeo,
        storage: makeStorage({
          [WEATHER_CACHE_KEY]: cacheOf(SNOW, STALE_MS + 1000),
        }),
        now: NOW,
      })
    ).toEqual(CLEAR_WEATHER);
  });

  it("ignores a corrupt cache", async () => {
    expect(
      await resolveWeather({
        geolocation: deniedGeo,
        storage: makeStorage({ [WEATHER_CACHE_KEY]: "{not json" }),
        now: NOW,
      })
    ).toEqual(CLEAR_WEATHER);
  });
});

describe("initialWeather", () => {
  it("is clear with no cache and cached when under 3 hours", () => {
    expect(initialWeather(NOW, makeStorage())).toEqual(CLEAR_WEATHER);
    expect(
      initialWeather(
        NOW,
        makeStorage({ [WEATHER_CACHE_KEY]: cacheOf(RAIN, 60_000) })
      )
    ).toEqual(RAIN);
    expect(
      initialWeather(
        NOW,
        makeStorage({ [WEATHER_CACHE_KEY]: cacheOf(RAIN, STALE_MS + 1) })
      )
    ).toEqual(CLEAR_WEATHER);
  });
});

describe("the weather toggle", () => {
  it("is off by default and persists on", () => {
    const storage = makeStorage();
    expect(readWeatherEnabled(storage)).toBe(false);
    writeWeatherEnabled(true, storage);
    expect(readWeatherEnabled(storage)).toBe(true);
    expect(storage.data.get(WEATHER_TOGGLE_KEY)).toBe("1");
  });

  it("clears the cache when turned off", () => {
    const storage = makeStorage({
      [WEATHER_TOGGLE_KEY]: "1",
      [WEATHER_CACHE_KEY]: cacheOf(RAIN, 1000),
    });
    writeWeatherEnabled(false, storage);
    expect(readWeatherEnabled(storage)).toBe(false);
    expect(storage.data.has(WEATHER_CACHE_KEY)).toBe(false);
  });

  it("survives storage that throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readWeatherEnabled(broken)).toBe(false);
    expect(() => writeWeatherEnabled(true, broken)).not.toThrow();
    expect(initialWeather(NOW, broken)).toEqual(CLEAR_WEATHER);
  });
});
