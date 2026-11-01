"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CLEAR_WEATHER,
  SKY_PHASES,
  skyPhase,
  type Heat,
  type SkyPhase,
  type Weather,
  type WeatherKind,
} from "@/lib/ever-onward/sky";
import {
  initialWeather,
  readWeatherEnabled,
  resolveWeather,
  writeWeatherEnabled,
} from "@/lib/ever-onward/weather";

const PHASE_CHECK_MS = 60 * 1000;
const KINDS: readonly WeatherKind[] = [
  "clear",
  "cloudy",
  "fog",
  "rain",
  "thunder",
  "snow",
];
const HEATS: readonly Heat[] = ["hot", "cold", "mild"];

interface Preview {
  phase: SkyPhase | null;
  weather: Weather | null;
}

/** `?sky=night&weather=rain&heat=hot` previews a look (never fetches). */
function readPreview(): Preview {
  const params = new URLSearchParams(window.location.search);
  const sky = params.get("sky");
  const kind = params.get("weather");
  const heat = params.get("heat");
  const phase = SKY_PHASES.find((p) => p === sky) ?? null;
  const weatherKind = KINDS.find((k) => k === kind) ?? null;
  const weatherHeat = HEATS.find((h) => h === heat) ?? "mild";
  return {
    phase,
    weather: weatherKind ? { kind: weatherKind, heat: weatherHeat } : null,
  };
}

export interface SkySettings {
  phase: SkyPhase;
  weather: Weather;
  isMatching: boolean;
  toggleMatching: () => void;
}

/**
 * The time of day (from the clock, rechecked each minute) and the weather.
 * Weather starts clear and only changes if the player opted in and a lookup
 * succeeds, so nothing here ever waits on the network.
 */
export function useSkySettings(): SkySettings {
  const [preview] = useState<Preview>(readPreview);
  const [phase, setPhase] = useState<SkyPhase>(() => skyPhase());
  const [isMatching, setIsMatching] = useState<boolean>(() =>
    readWeatherEnabled()
  );
  const [weather, setWeather] = useState<Weather>(() =>
    readWeatherEnabled() ? initialWeather() : CLEAR_WEATHER
  );

  useEffect(() => {
    const timer = setInterval(() => setPhase(skyPhase()), PHASE_CHECK_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isMatching || preview.weather) return;
    let isCurrent = true;
    resolveWeather().then((next) => {
      if (isCurrent) setWeather(next);
    });
    return () => {
      isCurrent = false;
    };
  }, [isMatching, preview.weather]);

  const toggleMatching = useCallback(() => {
    const next = !isMatching;
    writeWeatherEnabled(next);
    setIsMatching(next);
    if (!next) setWeather(CLEAR_WEATHER);
  }, [isMatching]);

  return {
    phase: preview.phase ?? phase,
    weather: preview.weather ?? weather,
    isMatching,
    toggleMatching,
  };
}
