"use client";

import { useEffect, useRef } from "react";
import { useGameStore } from "@/lib/planet-smasher/store";
import { formatInt } from "./format";

interface OdometerProps {
  /** The starting number; it also sets how many columns there are. */
  value: number;
}

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * The planet's population as rolling digit columns. It follows the store
 * through refs, so a hit never re-renders it.
 */
export default function Odometer({ value }: OdometerProps) {
  const count = Math.max(1, String(Math.max(0, Math.round(value))).length);
  const root = useRef<HTMLDivElement>(null);
  const columns = useRef<(HTMLSpanElement | null)[]>([]);
  const strips = useRef<(HTMLSpanElement | null)[]>([]);
  const commas = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const show = (n: number) => {
      const text = String(Math.max(0, Math.round(n))).padStart(count, "0");
      const first = text.search(/[1-9]/);
      const lead = first === -1 ? count - 1 : first;
      for (let i = 0; i < count; i++) {
        const strip = strips.current[i];
        if (strip)
          strip.style.transform = `translateY(-${Number(text[i]) * 10}%)`;
        const visible = i >= lead;
        columns.current[i]?.classList.toggle("hidden", !visible);
        commas.current[i]?.classList.toggle("hidden", !visible);
      }
      root.current?.setAttribute("aria-label", formatInt(n));
    };
    show(useGameStore.getState().planet?.population ?? value);
    return useGameStore.subscribe((s, prev) => {
      const next = s.planet?.population;
      if (next === undefined) return;
      if (next !== prev.planet?.population || s.planet !== prev.planet) {
        show(next);
      }
    });
  }, [count, value]);

  return (
    <div
      ref={root}
      role="img"
      aria-label={formatInt(value)}
      className="flex items-baseline font-mono text-3xl font-black tabular-nums leading-none text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] sm:text-5xl"
    >
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="flex items-baseline">
          <span
            ref={(el) => {
              columns.current[i] = el;
            }}
            data-testid="odometer-digit"
            className="block h-[1em] overflow-hidden"
          >
            <span
              ref={(el) => {
                strips.current[i] = el;
              }}
              className="block transition-transform duration-[350ms] ease-out"
            >
              {DIGITS.map((d) => (
                <span key={d} className="block h-[1em]" aria-hidden="true">
                  {d}
                </span>
              ))}
            </span>
          </span>
          {(count - 1 - i) % 3 === 0 && i < count - 1 && (
            <span
              ref={(el) => {
                commas.current[i] = el;
              }}
              aria-hidden="true"
            >
              ,
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
