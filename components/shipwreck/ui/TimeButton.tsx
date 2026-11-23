"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useStore } from "zustand";
import type { PlaybackStore } from "@/lib/shipwreck/playback";
import type { ShipSpec } from "@/lib/shipwreck/ships/types";
import {
  resolveTime,
  timesOf,
  type TimeChip,
  type TimeOption,
} from "@/lib/shipwreck/times";
import Icon from "./Icon";
import { FOCUS, PANEL, ROUND, ROUND_ON } from "./styles";

/** How long the words under a tap stay up (ms). */
export const TIME_HELP_MS = 4500;

/** The water-light steps, as the tray shows them. */
export const WATER_LIGHTS = [
  { level: 0, label: "Real water", words: "The water as it really was." },
  {
    level: 1,
    label: "Lighter water",
    words: "Clearer, lighter water, to follow her down.",
  },
  {
    level: 2,
    label: "Brightest water",
    words: "Very clear, bright water: easy to see her, but not how it was.",
  },
] as const;

interface TimeButtonProps {
  store: PlaybackStore;
  spec: ShipSpec;
  /** Where the tray opens: under the button (the HUD's top bar), beside it or above it. */
  bubble?: "below" | "left" | "above";
}

/**
 * A little sky at a time of day (SVG fills: the colours are data): the sky
 * fading to the horizon, a sun at its height (or the moon and stars, or
 * storm cloud), the sea.
 */
export function TimeChipArt({
  chip,
  className,
}: {
  chip: TimeChip;
  className?: string;
}) {
  const id = `sky-${chip.top.slice(1)}-${chip.low.slice(1)}`;
  const sunY = typeof chip.sun === "number" ? 19 - chip.sun * 14 : 0;
  return (
    <svg viewBox="0 0 48 30" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={chip.top} />
          <stop offset="1" stopColor={chip.low} />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={48} height={21} fill={`url(#${id})`} />
      {typeof chip.sun === "number" && (
        <circle
          data-sun={chip.sun}
          cx={30}
          cy={sunY}
          r={4}
          fill={chip.sun < 0.15 ? "#ffb070" : "#fff3c4"}
        />
      )}
      {chip.sun === "moon" && (
        <>
          <circle cx={32} cy={8} r={4} fill="#f1f5f9" />
          <circle cx={34} cy={6.8} r={3.4} fill={chip.top} />
          <circle cx={10} cy={5} r={0.8} fill="#f8fafc" />
          <circle cx={18} cy={10} r={0.6} fill="#f8fafc" />
          <circle cx={41} cy={14} r={0.7} fill="#f8fafc" />
          <circle cx={24} cy={4} r={0.5} fill="#f8fafc" />
        </>
      )}
      {chip.sun === "cloud" && (
        <path
          d="M10 13a4 4 0 0 1 4-4 5 5 0 0 1 9-1 4 4 0 0 1 6 3 3 3 0 0 1 0 6H12a3 3 0 0 1-2-4z"
          fill="#cbd5e1"
          fillOpacity={0.55}
        />
      )}
      <rect x={0} y={21} width={48} height={9} fill={chip.sea} />
    </svg>
  );
}

/**
 * The time button (1.9): a tap opens a tray of times of day, her real one
 * (the anchor row: the hour she really sank at) above others to try (the
 * sparkle row), and the water light (how clear and light the water is
 * under the surface, her real water first). Each is a picture; a tap
 * changes the scene live (the run goes on) and says what it is. Her real
 * time comes back with each new ship.
 */
export default function TimeButton({
  store,
  spec,
  bubble = "below",
}: TimeButtonProps) {
  const [open, setOpen] = useState(false);
  const [said, setSaid] = useState<{ title: string; line: string } | null>(
    null
  );
  useEffect(() => {
    if (!said) return;
    const id = setTimeout(() => setSaid(null), TIME_HELP_MS);
    return () => clearTimeout(id);
  }, [said]);
  const time = useStore(store, (s) => s.time);
  const underLight = useStore(store, (s) => s.underLight);
  const now = resolveTime(spec.id, time);
  const options = timesOf(spec.id);
  const real = options.filter((o) => o.id === "real");
  const fun = options.filter((o) => o.id !== "real");
  const current = options.find((o) => o.id === now) ?? options[0];

  const pick = (o: TimeOption) => {
    store.getState().setTime(o.id === "real" ? null : o.id);
    setSaid({
      title: o.label,
      line:
        o.id === "real"
          ? `${spec.name} as she really was.`
          : `Just for fun: ${spec.name} never sank at this time.`,
    });
  };

  const chipButton = (o: TimeOption) => {
    const on = o.id === now;
    return (
      <button
        key={o.id}
        type="button"
        aria-label={`Time: ${o.label}`}
        aria-pressed={on}
        data-testid="shipwreck-time"
        data-time={o.id}
        onClick={() => pick(o)}
        className={`grid size-14 touch-manipulation place-items-center rounded-xl border-2 bg-sky-950/60 active:scale-95 ${FOCUS} ${
          on ? "border-sky-300 bg-sky-800/70" : "border-white/10"
        }`}
      >
        <TimeChipArt chip={o.chip} className="h-9 w-12 rounded" />
      </button>
    );
  };

  const row = (
    kind: "real" | "fun" | "water",
    icon: "anchor" | "sparkle" | "bulb",
    label: string,
    children: ReactNode
  ) => (
    <div data-testid={`shipwreck-time-${kind}`} className="flex gap-2">
      <div className="flex w-12 shrink-0 flex-col items-center pt-2 text-slate-300">
        <Icon name={icon} className="size-6" />
        <span className="text-xs font-semibold">{label}</span>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={open ? "Close the times" : "Time of day: change the sky"}
        aria-expanded={open}
        data-testid="shipwreck-time-button"
        data-current={now}
        onClick={() => setOpen((o) => !o)}
        className={`${open ? ROUND_ON : ROUND} relative`}
      >
        <Icon name="sun-moon" className="size-8" />
        <TimeChipArt
          chip={current.chip}
          className="absolute bottom-0.5 right-0 h-4 w-6 rounded-sm"
        />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Times of day"
          data-testid="shipwreck-time-tray"
          className={`${PANEL} pointer-events-auto absolute z-20 flex w-[21rem] max-w-[calc(100vw-6rem)] flex-col gap-3 p-3 text-left ${
            bubble === "below"
              ? "right-0 top-full mt-3"
              : bubble === "left"
                ? "right-full top-0 mr-3"
                : "bottom-full left-1/2 mb-3 -translate-x-1/2"
          }`}
        >
          <button
            type="button"
            aria-label="Close the times"
            data-testid="shipwreck-time-close"
            onClick={() => setOpen(false)}
            className={`absolute right-2 top-2 grid size-10 touch-manipulation place-items-center rounded-full text-slate-300 active:scale-95 ${FOCUS}`}
          >
            <Icon name="close" className="size-5" />
          </button>
          {row("real", "anchor", "Real", real.map(chipButton))}
          {row("fun", "sparkle", "Fun", fun.map(chipButton))}
          {row(
            "water",
            "bulb",
            "Water",
            WATER_LIGHTS.map((w) => {
              const on = w.level === underLight;
              return (
                <button
                  key={w.level}
                  type="button"
                  aria-label={`Under water: ${w.label}`}
                  aria-pressed={on}
                  data-testid="shipwreck-water-light"
                  data-level={w.level}
                  onClick={() => {
                    store.getState().setUnderLight(w.level);
                    setSaid({ title: w.label, line: w.words });
                  }}
                  className={`grid size-14 touch-manipulation place-items-center rounded-xl border-2 active:scale-95 ${FOCUS} ${
                    on ? "border-sky-300" : "border-white/10"
                  } ${
                    w.level === 0
                      ? "bg-[#06202c]"
                      : w.level === 1
                        ? "bg-[#145a6e]"
                        : "bg-[#3a9bb0]"
                  }`}
                >
                  {/* A real-water anchor; one or two suns for the lighter. */}
                  {w.level === 0 ? (
                    <Icon name="anchor" className="size-6 text-slate-300" />
                  ) : (
                    <span className="flex gap-0.5 text-amber-200">
                      {Array.from({ length: w.level }, (_, i) => (
                        <Icon key={i} name="bulb" className="size-5" />
                      ))}
                    </span>
                  )}
                </button>
              );
            })
          )}
          {said && (
            <div role="status" data-testid="shipwreck-time-help">
              <p className="text-base font-semibold text-white">{said.title}</p>
              <p className="text-sm text-slate-300">{said.line}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
