"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  LOCKED_UNIVERSES,
  PLAYABLE_UNIVERSES,
} from "@/lib/ever-onward/universes";
import {
  currentSeason,
  seasonById,
  type Season,
} from "@/lib/ever-onward/season";
import {
  LIGHTHOUSE_DIM,
  LIGHTHOUSE_LIT,
  LIGHTHOUSE_ROWS,
  PADLOCK_COLORS,
  PADLOCK_ROWS,
} from "@/lib/ever-onward/start/sprites";
import { EVER_ONWARD_VERSION } from "@/lib/ever-onward/version";
import { useSkySettings } from "./useSkySettings";
import PixelSprite from "./PixelSprite";
import RetroText from "./RetroText";
import RobotScene from "./RobotScene";
import Sky from "./Sky";

interface StartScreenProps {
  /** A game was started before: the button says CONTINUE. */
  hasSave: boolean;
  /** Ids of universes with progress; their icons light up. */
  startedIds: readonly string[];
  onStart: () => void;
  /** Overrides the date-based look (previews and tests). */
  season?: Season;
}

const footerLinkClass =
  "rounded px-1 py-1 underline decoration-slate-600 underline-offset-4 hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300";

/** Chunky title letters: a 1-pixel-style drop shadow and a soft glow. */
const titleClass =
  "text-[min(12.5vw,4.5rem)] text-amber-300 [text-shadow:3px_3px_0_#78350f] drop-shadow-[0_0_12px_rgba(251,191,36,0.5)]";

/** `?season=winter` previews a look; otherwise the date decides. */
function pickSeason(): Season {
  const requested = new URLSearchParams(window.location.search).get("season");
  return seasonById(requested) ?? currentSeason();
}

export default function StartScreen({
  hasSave,
  startedIds,
  onStart,
  season: seasonOverride,
}: StartScreenProps) {
  const [season] = useState<Season>(() => seasonOverride ?? pickSeason());
  const sky = useSkySettings();
  const hasStarted = useRef(false);

  const start = useCallback(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    onStart();
  }, [onStart]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      // A focused link or button handles its own keys.
      if (
        event.target instanceof HTMLElement &&
        event.target.closest("a, button")
      )
        return;
      event.preventDefault();
      start();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [start]);

  const label = hasSave ? "Continue" : "Start";

  return (
    // Tapping anywhere starts too; the button is the keyboard and screen
    // reader route, so this wrapper needs no role.
    <div
      data-testid="eo-start"
      onClick={start}
      className="relative isolate flex min-h-dvh cursor-pointer flex-col overflow-hidden bg-[#02030a] text-amber-50 select-none"
    >
      <Sky
        particles={season.particles}
        phase={sky.phase}
        weather={sky.weather}
      />
      {/* Keeps the footer readable on bright skies. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-linear-to-t from-slate-950/70 to-transparent"
      />
      {/* Phosphor glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,rgba(251,191,36,0.16),transparent_62%)]"
      />

      <main className="relative z-10 mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-between gap-4 px-6 pt-[calc(2rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <header className="flex w-full flex-col items-center gap-3 pt-2 sm:pt-6">
          <h1 className="flex w-full flex-col items-center gap-3 sm:gap-4">
            <span className="sr-only">Ever Onward</span>
            <RetroText text="EVER" popFrom={0} className={titleClass} />
            <RetroText text="ONWARD" popFrom={4} className={titleClass} />
          </h1>
          <p className="eo-rise eo-d10 font-mono text-xs tracking-[0.25em] text-cyan-100 uppercase [text-shadow:1px_1px_0_#0b1233] sm:text-sm">
            Little machines. One simple goal.
          </p>
        </header>

        <div className="w-full py-2">
          <RobotScene season={season} phase={sky.phase} />
        </div>

        <div className="eo-rise eo-d12 flex w-full flex-col items-center gap-6">
          <button
            type="button"
            data-testid="eo-start-button"
            onClick={(event) => {
              event.stopPropagation();
              start();
            }}
            className="group flex min-h-14 items-center justify-center rounded-lg px-8 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b1233]"
          >
            <span className="sr-only">{label}</span>
            <span className="eo-prompt flex items-center gap-4">
              <RetroText
                text=">"
                className="text-2xl text-amber-300 [text-shadow:2px_2px_0_#78350f]"
              />
              <RetroText
                text={label.toUpperCase()}
                className="text-2xl text-amber-300 [text-shadow:2px_2px_0_#78350f] group-hover:text-amber-200"
              />
            </span>
          </button>

          <ul
            aria-label="Universes"
            className="flex items-end justify-center gap-5"
          >
            {PLAYABLE_UNIVERSES.map((def) => {
              const isLit = startedIds.includes(def.id);
              return (
                <li key={def.id} className="flex flex-col items-center">
                  <PixelSprite
                    rows={LIGHTHOUSE_ROWS}
                    palette={isLit ? LIGHTHOUSE_LIT : LIGHTHOUSE_DIM}
                    className={`h-11 ${isLit ? "drop-shadow-[0_0_8px_rgba(253,224,71,0.8)]" : ""}`}
                  />
                  <span className="sr-only">
                    {def.title}
                    {isLit ? ", lit" : ""}
                  </span>
                </li>
              );
            })}
            {LOCKED_UNIVERSES.map((locked) => (
              <li key={locked.id} className="flex flex-col items-center">
                <PixelSprite
                  rows={PADLOCK_ROWS}
                  palette={PADLOCK_COLORS}
                  className="h-6"
                />
                <span className="sr-only">{locked.title}, coming soon</span>
              </li>
            ))}
          </ul>
        </div>

        <footer className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-mono text-xs text-slate-200">
          <Link
            href="/ever-onward/versions"
            onClick={(event) => event.stopPropagation()}
            className={footerLinkClass}
          >
            v{EVER_ONWARD_VERSION} · what&apos;s new
          </Link>
          <button
            type="button"
            data-testid="eo-weather-toggle"
            aria-pressed={sky.isMatching}
            onClick={(event) => {
              event.stopPropagation();
              sky.toggleMatching();
            }}
            className={footerLinkClass}
          >
            ☁️ Match my weather: {sky.isMatching ? "on" : "off"}
          </button>
          <Link
            href="/"
            onClick={(event) => event.stopPropagation()}
            className={footerLinkClass}
          >
            gentryriggen.com
          </Link>
        </footer>
      </main>

      {/* CRT: scanlines, a soft vignette and a faint flicker. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-20 bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_2px,rgba(0,0,0,0.3)_2px,rgba(0,0,0,0.3)_3px)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-20 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.75)_100%)]"
      />
      <div
        aria-hidden="true"
        className="eo-flicker pointer-events-none absolute inset-0 z-20 bg-white opacity-5"
      />
    </div>
  );
}
