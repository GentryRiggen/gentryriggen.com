"use client";

import { setAudioBusy } from "@/lib/jim/audioActivity";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from "react";
import type { JimMenuItem } from "@/components/jim/JimHeader";
import {
  browserPlayerDeps,
  JimPlayer,
  type PlayerState,
  type PlayOptions,
} from "@/lib/jim/player";
import {
  loadAutoRead,
  loadSpeed,
  saveAutoRead,
  saveSpeed,
  speak,
  speechSupported,
  stopSpeaking,
  unlockSpeech,
} from "@/lib/jim/speech";
import { fetchSpeech } from "@/lib/jim/voice";

type GetToken = (force?: boolean) => Promise<string | null>;

export interface ReadAloud {
  /** Something can read here; the buttons and the menu entry show only then. */
  supported: boolean;
  /** Replies are read automatically (this device's setting). */
  auto: boolean;
  /** The message being read (or loading) now, if any. */
  speakingId: number | null;
  /** The player: what is on, how far, how fast. */
  state: PlayerState;
  /** Reads a message, or stops it when it is the one on. */
  toggle: (id: number, text: string) => void;
  /** Reads a new reply, when the setting is On and the page is showing. */
  readNew: (id: number, text: string) => void;
  /** Plays `text` in another voice (a persona sample), or stops it. */
  toggleSample: (key: string, text: string, voice?: string) => void;
  /** Plays `text` under `key`, replacing what is on. False: nothing could start. */
  play: (key: string, text: string, options?: PlayOptions) => boolean;
  /**
   * Shows `key` loading before its text exists, with what is happening
   * (`stage`). The signal aborts on stop (the bar's Cancel) or when
   * something else starts; null when nothing may start (the app lock).
   */
  prepare: (key: string, title: string, stage: string) => AbortSignal | null;
  /** What was being prepared failed: the bar shows why. */
  failPrepared: (message: string) => void;
  /** Unlocks audio inside a tap, ahead of a play that waits on the network. */
  prime: () => void;
  /** Call inside a tap (Send): lets a later automatic read start on iOS. */
  unlock: () => void;
  togglePause: () => void;
  setSpeed: (speed: number) => void;
  /** Clears the bar's error. */
  dismiss: () => void;
  stop: () => void;
  /** Who is speaking, for the lock screen. */
  setArtist: (name: string) => void;
  menuItem: JimMenuItem | null;
}

const MESSAGE_KEY = "msg:";
/** The morning brief's keys (useBriefAudio). */
const BRIEF_KEY = "brief:";

function speechFallback() {
  return speechSupported()
    ? {
        speak,
        stop: stopSpeaking,
        unlock: unlockSpeech,
      }
    : null;
}

/**
 * Read-aloud for the chat: one shared player (Jim's own voice from the
 * server, the browser's speech as the fallback), the "Read replies aloud"
 * setting and its menu entry. Jim's voice keeps playing with the screen
 * locked (the lock screen has its controls); the browser's speech stops
 * when the page is hidden, as iOS would cut it off anyway.
 */
export default function useReadAloud(
  getToken: GetToken,
  api: string,
  /** The app is locked: nothing is read, and what was on stops. */
  locked = false
): ReadAloud {
  // The chat only renders in the browser (after sign-in), so all of this
  // can be made now. The token getter and server are fixed for a sign-in.
  const [player] = useState(
    () =>
      new JimPlayer(
        browserPlayerDeps(
          (text, voice, signal) =>
            fetchSpeech(text, voice, getToken, api, signal),
          speechFallback(),
          loadSpeed,
          saveSpeed
        )
      )
  );
  const [supported] = useState(() => player.supported);
  // Before paint, so nothing starts in the gap after locking.
  useLayoutEffect(() => {
    player.setLocked(locked);
  }, [player, locked]);
  // Playing or loading keeps the app lock's idle timer from running out.
  useEffect(() => {
    const report = () => {
      const { status } = player.getState();
      setAudioBusy(status === "playing" || status === "loading");
    };
    report();
    const stop = player.subscribe(report);
    return () => {
      stop();
      setAudioBusy(false);
    };
  }, [player]);
  const [auto, setAuto] = useState(loadAutoRead);
  const state = useSyncExternalStore(
    player.subscribe,
    player.getState,
    player.getState
  );

  const stop = useCallback(() => player.stop(), [player]);

  const toggle = useCallback(
    (id: number, text: string) => {
      const key = `${MESSAGE_KEY}${id}`;
      if (player.getState().key === key) player.stop();
      else player.play(key, text);
    },
    [player]
  );

  const toggleSample = useCallback(
    (key: string, text: string, voice?: string) => {
      if (player.getState().key === key) player.stop();
      // A sample is about the voice: never the browser's stand-in.
      else player.play(key, text, { voice, fallback: false });
    },
    [player]
  );

  const play = useCallback(
    (key: string, text: string, options?: PlayOptions) =>
      player.play(key, text, options),
    [player]
  );

  const prepare = useCallback(
    (key: string, title: string, stage: string) =>
      player.prepare(key, title, stage),
    [player]
  );
  const failPrepared = useCallback(
    (message: string) => player.failPrepared(message),
    [player]
  );

  const prime = useCallback(() => player.unlock(), [player]);

  const readNew = useCallback(
    (id: number, text: string) => {
      // A read started while hidden is dropped, not queued for later.
      if (!supported || !auto || document.visibilityState === "hidden") return;
      // The morning brief (asked for on purpose) isn't cut off by a reply;
      // the reply stays readable from its Listen button.
      const { key, status } = player.getState();
      if (
        key?.startsWith(BRIEF_KEY) &&
        status !== "idle" &&
        status !== "error"
      ) {
        return;
      }
      player.play(`${MESSAGE_KEY}${id}`, text);
    },
    [supported, auto, player]
  );

  const unlock = useCallback(() => {
    if (supported && auto) player.unlock();
  }, [supported, auto, player]);

  const toggleAuto = useCallback(() => {
    const next = !auto;
    setAuto(next);
    saveAutoRead(next);
    // The menu tap is a gesture: unlock here too.
    if (next) player.unlock();
    else player.stop();
  }, [auto, player]);

  useEffect(() => {
    function onHidden() {
      if (
        document.visibilityState === "hidden" &&
        player.getState().engine === "speech"
      ) {
        player.stop();
      }
    }
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      player.destroy();
    };
  }, [player]);

  const togglePause = useCallback(() => player.togglePause(), [player]);
  const setSpeed = useCallback(
    (speed: number) => player.setSpeed(speed),
    [player]
  );
  const dismiss = useCallback(() => player.dismiss(), [player]);
  const setArtist = useCallback(
    (name: string) => player.setArtist(name),
    [player]
  );

  const speakingId =
    state.key?.startsWith(MESSAGE_KEY) === true
      ? Number(state.key.slice(MESSAGE_KEY.length))
      : null;

  return {
    supported,
    auto,
    speakingId,
    state,
    toggle,
    readNew,
    toggleSample,
    play,
    prepare,
    failPrepared,
    prime,
    unlock,
    togglePause,
    setSpeed,
    dismiss,
    stop,
    setArtist,
    menuItem: supported
      ? {
          label: `Read replies aloud: ${auto ? "On" : "Off"}`,
          onSelect: toggleAuto,
        }
      : null,
  };
}
