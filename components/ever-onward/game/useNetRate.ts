"use client";

import { useEffect, useRef, useState } from "react";
import {
  incomeRate,
  netRate,
  rateTrend,
  recordGain,
  recordReading,
  type GainSample,
  type RateReading,
  type RateTrend,
} from "@/lib/ever-onward/engine/rate";

const REFRESH_MS = 250;

export interface NetRate {
  /** Gross gain minus continuous costs, per second; may be negative. */
  rate: number;
  /** Rising, falling or steady against a few seconds ago. */
  trend: RateTrend;
}

const STILL: NetRate = { rate: 0, trend: "flat" };

/**
 * Smoothed net change per second of `value`: gains (taps, keepers) minus
 * `upkeep` (oil burned). Purchases never count, so spending isn't a loss.
 * The reading fades back toward -upkeep when the value stops rising.
 * A new `resetKey` (another currency) starts the reading clean.
 */
export function useNetRate(
  value: number,
  resetKey: string,
  upkeep: number
): NetRate {
  const [reading, setReading] = useState<NetRate>(STILL);
  const samples = useRef<GainSample[]>([]);
  const history = useRef<RateReading[]>([]);
  const previous = useRef<number | null>(null);
  const startedAt = useRef<number | null>(null);
  const lastKey = useRef(resetKey);
  const latestUpkeep = useRef(upkeep);

  useEffect(() => {
    latestUpkeep.current = upkeep;
  }, [upkeep]);

  useEffect(() => {
    const now = performance.now();
    if (lastKey.current !== resetKey) {
      lastKey.current = resetKey;
      samples.current = [];
      history.current = [];
      previous.current = null;
      startedAt.current = now;
    }
    startedAt.current ??= now;
    samples.current = recordGain(samples.current, previous.current, value, now);
    previous.current = value;
  }, [value, resetKey]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = performance.now();
      const gross = incomeRate(samples.current, now, startedAt.current ?? now);
      const rate = netRate(gross, latestUpkeep.current);
      const trend = rateTrend(history.current, now, rate);
      history.current = recordReading(history.current, { at: now, rate });
      setReading((current) =>
        current.rate === rate && current.trend === trend
          ? current
          : { rate, trend }
      );
    }, REFRESH_MS);
    return () => window.clearInterval(interval);
  }, []);

  return reading;
}
