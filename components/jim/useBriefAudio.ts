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
const BRIEF_TITLE = "Your morning";
const FAILED = "Couldn't get your morning brief. Try again in a moment.";

/** What the brief is waiting on, as the bar and the Home button say it. */
export const BRIEF_STAGES = {
  /** The server is writing today's script (a model call: ~10 s). */
  script: "Writing your morning…",
  /** The script is here; the first part of the voice is on its way. */
  voice: "Warming up the voice…",
} as const;

export interface BriefAudio {
  /**
   * Fetches today's script and reads it in Jim's voice. Call it inside the
   * tap: it unlocks audio and shows the bar before anything is awaited.
   */
  playBrief: (options?: { fresh?: boolean }) => Promise<void>;
  /** The brief was asked for over other audio: it waits for a tap. */
  chip: boolean;
  /** The chip's tap: start (or resume) it, now that there is a gesture. */
  playFromChip: () => void;
  /** What the brief is waiting on now; null once it plays (or isn't on). */
  stage: string | null;
  /** Why the brief didn't start or stopped (the daily limit, the network). */
  error: string | null;
}

function isBrief(key: string | null): boolean {
  return key?.startsWith(BRIEF_KEY) === true;
}

/**
 * The morning brief as audio. The now-playing bar shows it from the tap
 * on: "Writing your morning…" while the script is written, "Warming up the
 * voice…" while the first part loads, then the player. `?listen=brief` (a
 * notification tap) asks for it without a tap in the page; when iOS
 * refuses to start it, the bar waits on a Tap to play. It never cuts in
 * over other audio: then a "Tap to play your morning" chip waits instead.
 */
export default function useBriefAudio(
  getToken: GetToken,
  api: string,
  reader: ReadAloud
): BriefAudio {
  const [refused, setRefused] = useState(false);
  const readerRef = useRef(reader);
  useLayoutEffect(() => {
    readerRef.current = reader;
  });
  const busy = useRef(false);

  const start = useCallback(
    async (options: { fresh?: boolean }) => {
      const now = readerRef.current;
      const { key, status } = now.state;
      // Already on (or on its way): a second ask doesn't restart it, and
      // a paused one (iOS waiting on a tap) carries on.
      if (busy.current) return;
      if (isBrief(key)) {
        if (status === "paused") {
          now.togglePause();
          return;
        }
        if (status === "loading" || status === "playing") return;
      }
      busy.current = true;
      setRefused(false);
      // Inside a tap, before any await: unlocks audio for the play that
      // follows the fetch (iOS), then shows the bar in the same frame.
      now.prime();
      const signal = now.prepare(BRIEF_KEY, BRIEF_TITLE, BRIEF_STAGES.script);
      if (!signal) {
        busy.current = false;
        return;
      }
      try {
        const script = await fetchBriefScript(
          getToken,
          options,
          undefined,
          api,
          signal
        );
        // Cancelled (the bar's ×), or something else started meanwhile.
        if (signal.aborted) return;
        const started = readerRef.current.play(
          `${BRIEF_KEY}${script.day}`,
          script.text,
          { artist: "Jim", stage: BRIEF_STAGES.voice }
        );
        // Nothing could start (locked, nothing to say): leave the way in.
        if (!started) setRefused(true);
      } catch (err) {
        if (signal.aborted) return;
        // The server's own words (the rewrite limit) show as they are.
        readerRef.current.failPrepared(
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

  const playBrief = useCallback(
    (options: { fresh?: boolean } = {}) => start(options),
    [start]
  );

  useEffect(
    () =>
      onOpenIntent((intent) => {
        if (intent.listen !== "brief") return;
        const now = readerRef.current;
        // Never cut in over other audio without a tap: the chip waits.
        if (
          !isBrief(now.state.key) &&
          (now.state.status === "playing" || now.state.status === "loading")
        ) {
          setRefused(true);
          return;
        }
        void start({});
      }),
    [start]
  );

  const playFromChip = useCallback(() => {
    setRefused(false);
    void playBrief();
  }, [playBrief]);

  const { key, status, stage, error, errorKey } = reader.state;
  return {
    playBrief,
    chip: refused,
    playFromChip,
    stage: isBrief(key) && status === "loading" ? stage : null,
    error: status === "error" && isBrief(errorKey) ? error : null,
  };
}
