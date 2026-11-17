import { useCallback, useEffect, useRef, useState } from "react";
import type { EmoteId } from "@/lib/flamelings/catalog";

const EMOTE_MS = 1600;

/** Plays one emote at a time for about 1.5 seconds. */
export function useEmote() {
  const [current, setCurrent] = useState<{
    emote: EmoteId;
    key: number;
  } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const counter = useRef(0);

  const play = useCallback((emote: EmoteId) => {
    window.clearTimeout(timer.current);
    counter.current += 1;
    setCurrent({ emote, key: counter.current });
    timer.current = window.setTimeout(() => setCurrent(null), EMOTE_MS);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return { emote: current?.emote ?? null, emoteKey: current?.key ?? 0, play };
}
