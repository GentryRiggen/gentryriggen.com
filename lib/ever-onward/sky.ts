/**
 * What the sky looks like on the start screen: the time of day (always from
 * the device clock) and the weather (only when the player opts in).
 * Everything here is pure; fetching lives in `weather.ts`.
 */

export type SkyPhase = "dawn" | "day" | "dusk" | "night";

export const SKY_PHASES: readonly SkyPhase[] = ["dawn", "day", "dusk", "night"];

export type WeatherKind =
  "clear" | "cloudy" | "fog" | "rain" | "thunder" | "snow";

export type Heat = "hot" | "cold" | "mild";

export interface Weather {
  kind: WeatherKind;
  heat: Heat;
}

/** What the sky shows unless real weather says otherwise. Never random. */
export const CLEAR_WEATHER: Weather = { kind: "clear", heat: "mild" };

export const HOT_FROM_C = 30;
export const COLD_UP_TO_C = 0;

/**
 * Dawn, day, dusk or night from local time. The bands shift a little with the
 * month (earlier light in summer, later in winter) without needing a location.
 */
export function skyPhase(date: Date = new Date()): SkyPhase {
  const hour = date.getHours() + date.getMinutes() / 60;
  const month = date.getMonth() + 1;
  const isLongDays = month >= 5 && month <= 8;
  const isShortDays = month === 11 || month === 12 || month === 1;
  const dawnStart = isLongDays ? 4.5 : isShortDays ? 6 : 5;
  const dayStart = dawnStart + 2;
  const duskStart = isLongDays ? 19.5 : isShortDays ? 16.5 : 18;
  const nightStart = duskStart + 2;
  if (hour >= dawnStart && hour < dayStart) return "dawn";
  if (hour >= dayStart && hour < duskStart) return "day";
  if (hour >= duskStart && hour < nightStart) return "dusk";
  return "night";
}

/** The WMO weather code from Open-Meteo, as a kind of sky. */
export function weatherKindFromCode(code: number, cloudCover = 0): WeatherKind {
  if (code === 0 || code === 1) return cloudCover >= 70 ? "cloudy" : "clear";
  if (code === 2) return cloudCover >= 60 ? "cloudy" : "clear";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 67) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 80 && code <= 82) return "rain";
  if (code === 85 || code === 86) return "snow";
  if (code >= 95 && code <= 99) return "thunder";
  return "clear";
}

export function heatFromTemperature(celsius: number): Heat {
  if (celsius >= HOT_FROM_C) return "hot";
  if (celsius <= COLD_UP_TO_C) return "cold";
  return "mild";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Reads the `current` block of an Open-Meteo reply; null if it is malformed. */
export function parseCurrentWeather(body: unknown): Weather | null {
  if (typeof body !== "object" || body === null) return null;
  const current = (body as { current?: unknown }).current;
  if (typeof current !== "object" || current === null) return null;
  const { weather_code, temperature_2m, cloud_cover, snowfall } =
    current as Record<string, unknown>;
  if (!isFiniteNumber(weather_code)) return null;
  let kind = weatherKindFromCode(
    weather_code,
    isFiniteNumber(cloud_cover) ? cloud_cover : 0
  );
  if (kind === "rain" && isFiniteNumber(snowfall) && snowfall > 0) {
    kind = "snow";
  }
  const heat = isFiniteNumber(temperature_2m)
    ? heatFromTemperature(temperature_2m)
    : "mild";
  return { kind, heat };
}

export function isWeather(value: unknown): value is Weather {
  if (typeof value !== "object" || value === null) return false;
  const { kind, heat } = value as Record<string, unknown>;
  return (
    (kind === "clear" ||
      kind === "cloudy" ||
      kind === "fog" ||
      kind === "rain" ||
      kind === "thunder" ||
      kind === "snow") &&
    (heat === "hot" || heat === "cold" || heat === "mild")
  );
}

/** One decimal is about 10 km: enough for weather, too coarse to find a home. */
export function roundCoordinate(value: number): number {
  return Math.round(value * 10) / 10;
}
