"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { JimMenuItem } from "@/components/jim/JimHeader";
import {
  loadAutoRead,
  saveAutoRead,
  speak,
  speechSupported,
  stopSpeaking,
  unlockSpeech,
} from "@/lib/jim/speech";

interface ReadAloud {
  /** This browser can speak; the buttons and the menu entry show only then. */
  supported: boolean;
  /** Replies are read automatically (this device's setting). */
  auto: boolean;
  /** The message being read now, if any. */
  speakingId: number | null;
  /** Reads a message, or stops it when it is the one speaking. */
  toggle: (id: number, text: string) => void;
  /** Reads a new reply, when the setting is On. */
  readNew: (id: number, text: string) => void;
  /** Call inside a tap (Send): lets a later automatic read start on iOS. */
  unlock: () => void;
  stop: () => void;
  menuItem: JimMenuItem | null;
}

/**
 * Read-aloud state for the chat: which reply is speaking, the "Read replies
 * aloud" setting and its menu entry. Speech stops when the page is hidden
 * or the chat unmounts.
 */
export default function useReadAloud(): ReadAloud {
  // The chat only renders in the browser (after sign-in), so both can be read now.
  const [supported] = useState(speechSupported);
  const [auto, setAuto] = useState(loadAutoRead);
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  /** Identifies the current speech, so a cut-off one can't end the next. */
  const run = useRef(0);

  const stop = useCallback(() => {
    run.current += 1;
    stopSpeaking();
    setSpeakingId(null);
  }, []);

  const start = useCallback((id: number, text: string) => {
    const mine = ++run.current;
    const started = speak(text, () => {
      if (run.current === mine) setSpeakingId(null);
    });
    setSpeakingId(started ? id : null);
  }, []);

  const toggle = useCallback(
    (id: number, text: string) => {
      if (speakingId === id) stop();
      else start(id, text);
    },
    [speakingId, start, stop]
  );

  const readNew = useCallback(
    (id: number, text: string) => {
      // Speech started while hidden is dropped, not queued for later.
      if (supported && auto && document.visibilityState !== "hidden") {
        start(id, text);
      }
    },
    [supported, auto, start]
  );

  const unlock = useCallback(() => {
    if (supported && auto) unlockSpeech();
  }, [supported, auto]);

  const toggleAuto = useCallback(() => {
    const next = !auto;
    setAuto(next);
    saveAutoRead(next);
    if (next) unlockSpeech();
    else stop();
  }, [auto, stop]);

  useEffect(() => {
    if (!supported) return;
    function onHidden() {
      if (document.visibilityState === "hidden") stop();
    }
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      stopSpeaking();
    };
  }, [supported, stop]);

  return {
    supported,
    auto,
    speakingId,
    toggle,
    readNew,
    unlock,
    stop,
    menuItem: supported
      ? {
          label: `Read replies aloud: ${auto ? "On" : "Off"}`,
          onSelect: toggleAuto,
        }
      : null,
  };
}
