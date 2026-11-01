import type { ReactNode } from "react";
import type { Season } from "@/lib/ever-onward/season";
import type { SkyPhase, Weather } from "@/lib/ever-onward/sky";
import Sky from "./Sky";

interface RetroBackdropProps {
  /** Omitted while server-rendering: the page starts dark, then the sky fades in. */
  sky?: { season: Season; phase: SkyPhase; weather: Weather };
  /** Classes for the outer wrapper (layout, cursor). */
  className?: string;
  children: ReactNode;
}

/**
 * The start screen's look, shared with the hub and the versions page: the
 * day/night sky, a phosphor glow, and the CRT scanlines, vignette and flicker
 * over everything.
 */
export default function RetroBackdrop({
  sky,
  className = "",
  children,
}: RetroBackdropProps) {
  return (
    <div
      className={`relative isolate min-h-dvh overflow-hidden bg-[#02030a] text-amber-50 ${className}`}
    >
      {sky && (
        <Sky
          particles={sky.season.particles}
          phase={sky.phase}
          weather={sky.weather}
        />
      )}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-linear-to-t from-slate-950/70 to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,rgba(251,191,36,0.16),transparent_62%)]"
      />
      {children}
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
