import {
  CLEAR_WEATHER,
  isWeather,
  parseCurrentWeather,
  roundCoordinate,
  type Weather,
} from "./sky";

/**
 * Opt-in real weather for the start screen.
 *
 * Privacy: the position is rounded to one decimal (about 10 km) before it is
 * used for anything, goes only to Open-Meteo (no key, no account), and is
 * never stored. Only the resulting weather and a timestamp are cached.
 */

export const WEATHER_TOGGLE_KEY = "ever-onward-weather";
export const WEATHER_CACHE_KEY = "ever-onward-weather-cache";
export const FRESH_MS = 30 * 60 * 1000;
export const STALE_MS = 3 * 60 * 60 * 1000;
export const REQUEST_TIMEOUT_MS = 8000;

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function browserStorage(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readWeatherEnabled(
  storage: StorageLike | null = browserStorage()
): boolean {
  try {
    return storage?.getItem(WEATHER_TOGGLE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Turning it off also forgets the cached weather. */
export function writeWeatherEnabled(
  enabled: boolean,
  storage: StorageLike | null = browserStorage()
): void {
  try {
    if (enabled) {
      storage?.setItem(WEATHER_TOGGLE_KEY, "1");
    } else {
      storage?.removeItem(WEATHER_TOGGLE_KEY);
      storage?.removeItem(WEATHER_CACHE_KEY);
    }
  } catch {
    // Private mode or blocked storage: the choice just lasts this visit.
  }
}

/** The cached weather if it is younger than `maxAgeMs`, else null. */
export function readCachedWeather(
  now: number,
  maxAgeMs: number,
  storage: StorageLike | null = browserStorage()
): Weather | null {
  try {
    const raw = storage?.getItem(WEATHER_CACHE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { weather, at } = parsed as { weather?: unknown; at?: unknown };
    if (typeof at !== "number" || !isWeather(weather)) return null;
    const age = now - at;
    return age >= 0 && age < maxAgeMs ? weather : null;
  } catch {
    return null;
  }
}

function writeCachedWeather(
  weather: Weather,
  now: number,
  storage: StorageLike | null
): void {
  try {
    storage?.setItem(WEATHER_CACHE_KEY, JSON.stringify({ weather, at: now }));
  } catch {
    // Not cached; the next visit asks again.
  }
}

/** What to show before anything is fetched: recent weather or clear skies. */
export function initialWeather(
  now: number = Date.now(),
  storage: StorageLike | null = browserStorage()
): Weather {
  return readCachedWeather(now, STALE_MS, storage) ?? CLEAR_WEATHER;
}

export function buildForecastUrl(latitude: number, longitude: number): string {
  const lat = roundCoordinate(latitude);
  const lon = roundCoordinate(longitude);
  return `${FORECAST_URL}?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day,cloud_cover,precipitation,snowfall&timezone=auto`;
}

export interface WeatherDeps {
  geolocation?: Pick<Geolocation, "getCurrentPosition"> | null;
  fetchFn?: typeof fetch;
  storage?: StorageLike | null;
  now?: number;
}

function locate(
  geolocation: Pick<Geolocation, "getCurrentPosition">
): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      reject,
      {
        enableHighAccuracy: false,
        timeout: REQUEST_TIMEOUT_MS,
        maximumAge: 60 * 60 * 1000,
      }
    );
  });
}

/**
 * The weather to show for an opted-in player. Fresh cache wins; otherwise ask
 * the browser for a rough position and Open-Meteo for the weather. Any
 * failure falls back to weather under 3 hours old, else clear skies.
 */
export async function resolveWeather(deps: WeatherDeps = {}): Promise<Weather> {
  const now = deps.now ?? Date.now();
  const storage = deps.storage === undefined ? browserStorage() : deps.storage;
  const fresh = readCachedWeather(now, FRESH_MS, storage);
  if (fresh) return fresh;
  try {
    const geolocation =
      deps.geolocation === undefined
        ? typeof navigator === "undefined"
          ? null
          : navigator.geolocation
        : deps.geolocation;
    if (!geolocation) throw new Error("no geolocation");
    const { latitude, longitude } = await locate(geolocation);
    const fetchFn = deps.fetchFn ?? fetch;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let body: unknown;
    try {
      const response = await fetchFn(buildForecastUrl(latitude, longitude), {
        signal: controller.signal,
        credentials: "omit",
        referrerPolicy: "no-referrer",
      });
      if (!response.ok) throw new Error(`weather ${response.status}`);
      body = await response.json();
    } finally {
      clearTimeout(timer);
    }
    const weather = parseCurrentWeather(body);
    if (!weather) throw new Error("bad weather reply");
    writeCachedWeather(weather, now, storage);
    return weather;
  } catch {
    return readCachedWeather(now, STALE_MS, storage) ?? CLEAR_WEATHER;
  }
}
