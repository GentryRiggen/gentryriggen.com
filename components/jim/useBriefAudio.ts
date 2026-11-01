"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { ReadAloud } from "@/components/jim/useReadAloud";
import { JimError } from "@/lib/jim/api";
import { fetchBriefScript } from "@/lib/jim/brief";
import { onOpenIntent } from "@/lib/jim/openUrl";

type GetToken = (force?: boolean) => Promise<string | null>;

const BRIEF_KEY = "brief:";
const FAILED = "Couldn't get your morning brief. Try again in a moment.";

export interface BriefAudio {
  /** Fetches today's script and reads it in Jim's voice. */
  playBrief: (options?: { fresh?: boolean }) => Promise<void>;
  /** The brief was asked for but never started (no tap behind it). */
  chip: boolean;
  /** The chip's tap: start (or resume) it, now that there is a gesture. */
  playFromChip: () => void;
  /** Why the brief didn't start, when the server said (the daily limit). */
  error: string | null;
}

function isBrief(key: string | null): boolean {
  return key?.startsWith(BRIEF_KEY) === true;
}

/**
 * The morning brief as audio. `?listen=brief` (a notification tap) asks for
 * it without a tap in the page, which iOS may refuse: then a "Play your
 * morning" chip waits for one. A brief already playing is left alone.
 */
export default function useBriefAudio(
  getToken: GetToken,
  api: string,
  reader: ReadAloud
): BriefAudio {
  const [refused, setRefused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const readerRef = useRef(reader);
  useLayoutEffect(() => {
    readerRef.current = reader;
  });
  const busy = useRef(false);
  /** Started without a tap: a pause that follows is the browser's refusal. */
  const [unattended, setUnattended] = useState(false);

  const playBrief = useCallback(
    async (options: { fresh?: boolean } = {}) => {
      const now = readerRef.current;
      // Already on (or on its way): a second ask doesn't restart it.
      if (
        busy.current ||
        (isBrief(now.state.key) &&
          (now.state.status === "loading" ||
            now.state.status === "playing" ||
            now.state.status === "paused"))
      ) {
        return;
      }
      busy.current = true;
      setError(null);
      setRefused(false);
      // Inside a tap this unlocks audio for the play that follows the fetch.
      now.prime();
      try {
        const script = await fetchBriefScript(
          getToken,
          options,
          undefined,
          api
        );
        const started = readerRef.current.play(
          `${BRIEF_KEY}${script.day}`,
          script.text,
          { artist: "Jim" }
        );
        // Nothing could start (locked, nothing to say): leave the way in.
        if (!started) setRefused(true);
      } catch (err) {
        // The server's own words (the rewrite limit) show as they are.
        setError(
          err instanceof Error && !(err instanceof JimError) && err.message
            ? err.message
            : FAILED
        );
      } finally {
        busy.current = false;
      }
    },
    [getToken, api]
  );

  useEffect(
    () =>
      onOpenIntent((intent) => {
        if (intent.listen !== "brief") return;
        setUnattended(true);
        void playBrief();
      }),
    [playBrief]
  );

  // The player waits on a tap when the browser refused to start the audio.
  const { key, status } = reader.state;
  const waiting = unattended && isBrief(key) && status === "paused";
  const chip = refused || waiting;

  const playFromChip = useCallback(() => {
    setUnattended(false);
    const now = readerRef.current;
    if (isBrief(now.state.key) && now.state.status === "paused") {
      now.togglePause();
      return;
    }
    setRefused(false);
    void playBrief();
  }, [playBrief]);

  return { playBrief, chip, playFromChip, error };
}
