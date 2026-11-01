"use client";

import { useEffect, useRef, useState } from "react";
import {
  incomeRate,
  recordGain,
  type GainSample,
} from "@/lib/ever-onward/engine/rate";

const REFRESH_MS = 250;

/**
 * Smoothed gross gain per second of `value` (spending doesn't count). The
 * reading fades back to 0 on its own when the value stops rising.
 * A new `resetKey` (another currency) starts the reading clean.
 */
export function useIncomeRate(value: number, resetKey: string): number {
  const [rate, setRate] = useState(0);
  const samples = useRef<GainSample[]>([]);
  const previous = useRef<number | null>(null);
  const startedAt = useRef<number | null>(null);
  const lastKey = useRef(resetKey);

  useEffect(() => {
    const now = performance.now();
    if (lastKey.current !== resetKey) {
      lastKey.current = resetKey;
      samples.current = [];
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
      setRate(incomeRate(samples.current, now, startedAt.current ?? now));
    }, REFRESH_MS);
    return () => window.clearInterval(interval);
  }, []);

  return rate;
}
