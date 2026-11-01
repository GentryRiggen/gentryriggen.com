"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import {
  currentSeason,
  seasonById,
  type Season,
} from "@/lib/ever-onward/season";
import RetroBackdrop from "./RetroBackdrop";
import { useSkySettings } from "./useSkySettings";

/** `?season=winter` previews a look; otherwise the date decides. */
export function pickSeason(): Season {
  const requested = new URLSearchParams(window.location.search).get("season");
  return seasonById(requested) ?? currentSeason();
}

const subscribe = () => () => undefined;

function LiveBackdrop({ children }: { children: ReactNode }) {
  const [season] = useState<Season>(pickSeason);
  const { phase, weather } = useSkySettings();
  return (
    <RetroBackdrop sky={{ season, phase, weather }}>{children}</RetroBackdrop>
  );
}

/**
 * A page on the retro backdrop. The sky depends on the clock and the browser,
 * so a server render (the versions page) shows the dark CRT backdrop and the
 * sky arrives once the page is live. Children keep their place either way.
 */
export default function RetroPage({ children }: { children: ReactNode }) {
  const isLive = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
  return isLive ? (
    <LiveBackdrop>{children}</LiveBackdrop>
  ) : (
    <RetroBackdrop>{children}</RetroBackdrop>
  );
}
