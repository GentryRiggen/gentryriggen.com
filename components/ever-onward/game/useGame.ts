"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  buy,
  manualAction,
  manualGain,
  reconcileRun,
  tick,
} from "@/lib/ever-onward/engine/engine";
import {
  buyPrestigeUpgrade,
  endRun,
  newUniverseSave,
} from "@/lib/ever-onward/engine/prestige";
import { loadSave, writeSave } from "@/lib/ever-onward/engine/save";
import type {
  RunState,
  SaveData,
  UniverseDef,
  UniverseSave,
} from "@/lib/ever-onward/engine/types";
import { getPlayableUniverse } from "@/lib/ever-onward/universes";

/** The sim and the readouts update this often; CSS handles smooth motion. */
const STEP_SECONDS = 0.1;
const AUTOSAVE_MS = 10_000;

/** Marks the history entry pushed when a game opens. */
const GAME_HISTORY_KEY = "everOnwardGame";

/** What the player has to click through before play resumes. */
export type Overlay = "phase" | "ending" | null;

/** A universe save the current build can play (phase in range). */
function sanitize(def: UniverseDef, universe: UniverseSave): UniverseSave {
  return {
    ...universe,
    run: reconcileRun(def, universe.run, universe.prestigeUpgrades),
  };
}

/** A run that just finished or entered a new phase is saved at once. */
const isMilestone = (before: RunState, after: RunState): boolean =>
  after.complete !== before.complete || after.phase !== before.phase;

/** Marks a run whose intro moment has not been seen (a brand new run). */
const isFresh = (universe: UniverseSave): boolean =>
  universe.run.time === 0 && universe.run.taps === 0;

export interface GameApi {
  /** Null until the save has been read on the client. */
  save: SaveData | null;
  recovered: boolean;
  activeId: string | null;
  def: UniverseDef | null;
  universe: UniverseSave | null;
  overlay: Overlay;
  open(id: string): void;
  leave(): void;
  /** Taps once; returns what the tap earned. */
  tap(): number;
  buyUpgrade(id: string): void;
  buyEmberUpgrade(id: string): void;
  dismissOverlay(): void;
  /** Ends the run (finished, or restarted for embers) and starts a new one. */
  restart(): void;
  /** Swaps in a whole save (from a backup code), writes it and shows the hub. */
  replaceSave(next: SaveData): void;
}

export function useGame(): GameApi {
  const saveRef = useRef<SaveData | null>(null);
  const [save, setSave] = useState<SaveData | null>(null);
  const [recovered, setRecovered] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  /** Transitions the player has already seen; -1 shows the opening intro. */
  const [seenTransitions, setSeenTransitions] = useState(0);
  const [endingDone, setEndingDone] = useState(false);

  const def = activeId ? (getPlayableUniverse(activeId) ?? null) : null;
  const universe = save && activeId ? (save.universes[activeId] ?? null) : null;

  const commit = useCallback((next: SaveData) => {
    saveRef.current = next;
    setSave(next);
  }, []);

  /** The save last written; an unchanged one isn't written again. */
  const writtenRef = useRef<SaveData | null>(null);

  const persist = useCallback(() => {
    const current = saveRef.current;
    if (!current || current === writtenRef.current) return;
    if (writeSave(current)) writtenRef.current = current;
  }, []);

  const replaceUniverse = useCallback(
    (id: string, next: UniverseSave, saveNow = false) => {
      const current = saveRef.current;
      if (!current) return;
      commit({ ...current, universes: { ...current.universes, [id]: next } });
      if (saveNow) persist();
    },
    [commit, persist]
  );

  // Read the save once, on the client (static export: no localStorage on the
  // server, so it can't be an initial state without a hydration mismatch).
  useEffect(() => {
    const { save: loaded, recovered: wasRecovered } = loadSave();
    saveRef.current = loaded;
    writtenRef.current = loaded;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSave(loaded);
    setRecovered(wasRecovered);
  }, []);

  const open = useCallback(
    (id: string) => {
      const target = getPlayableUniverse(id);
      const current = saveRef.current;
      if (!target || !current) return;
      const existing = current.universes[id];
      const ready = existing
        ? sanitize(target, existing)
        : newUniverseSave(target);
      replaceUniverse(id, ready, true);
      setSeenTransitions(isFresh(ready) ? -1 : ready.run.transitions.length);
      setEndingDone(ready.run.complete);
      setActiveId(id);
      // One history entry per game, so Back returns to the hub.
      window.history.pushState({ [GAME_HISTORY_KEY]: id }, "");
    },
    [replaceUniverse]
  );

  const leave = useCallback(() => {
    // Popping the game's history entry runs the popstate handler below.
    if (window.history.state?.[GAME_HISTORY_KEY]) {
      window.history.back();
      return;
    }
    persist();
    setActiveId(null);
  }, [persist]);

  // Browser Back (or Forward off the game's entry) returns to the hub.
  useEffect(() => {
    if (!activeId) return;
    const handlePopState = () => {
      persist();
      setActiveId(null);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [activeId, persist]);

  const run = universe?.run ?? null;
  const overlay: Overlay = !run
    ? null
    : run.complete
      ? endingDone
        ? null
        : "ending"
      : run.transitions.length > seenTransitions
        ? "phase"
        : null;
  const isPaused = overlay !== null;

  // The game loop: real time while the page is visible, nothing while hidden.
  useEffect(() => {
    if (!activeId || !def || isPaused) return;
    let frame = 0;
    let last: number | null = null;
    let pending = 0;

    const step = (now: number) => {
      frame = requestAnimationFrame(step);
      if (last !== null) pending += (now - last) / 1000;
      last = now;
      if (pending < STEP_SECONDS) return;
      const current = saveRef.current?.universes[activeId];
      const dt = pending;
      pending = 0;
      if (!current || !saveRef.current) return;
      const nextRun = tick(def, current.run, dt);
      if (nextRun === current.run) return;
      commit({
        ...saveRef.current,
        universes: {
          ...saveRef.current.universes,
          [activeId]: { ...current, run: nextRun },
        },
      });
      if (isMilestone(current.run, nextRun)) persist();
    };

    const start = () => {
      if (frame || document.visibilityState !== "visible") return;
      last = null;
      pending = 0;
      frame = requestAnimationFrame(step);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") start();
      else stop();
    };

    start();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [activeId, def, isPaused, commit, persist]);

  // Autosave, and a last write when the page goes away.
  useEffect(() => {
    const interval = window.setInterval(persist, AUTOSAVE_MS);
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") persist();
    };
    window.addEventListener("pagehide", persist);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("pagehide", persist);
      document.removeEventListener("visibilitychange", handleVisibility);
      persist();
    };
  }, [persist]);

  const tap = useCallback((): number => {
    const current = activeId ? saveRef.current?.universes[activeId] : undefined;
    if (!activeId || !def || !current || isPaused) return 0;
    const gain = manualGain(def, current.run);
    const nextRun = manualAction(def, current.run);
    if (nextRun !== current.run)
      replaceUniverse(
        activeId,
        { ...current, run: nextRun },
        isMilestone(current.run, nextRun)
      );
    return gain;
  }, [activeId, def, isPaused, replaceUniverse]);

  const buyUpgrade = useCallback(
    (id: string) => {
      const current = activeId
        ? saveRef.current?.universes[activeId]
        : undefined;
      if (!activeId || !def || !current || isPaused) return;
      const nextRun = buy(def, current.run, id);
      if (nextRun !== current.run)
        replaceUniverse(activeId, { ...current, run: nextRun }, true);
    },
    [activeId, def, isPaused, replaceUniverse]
  );

  const buyEmberUpgrade = useCallback(
    (id: string) => {
      const current = activeId
        ? saveRef.current?.universes[activeId]
        : undefined;
      if (!activeId || !def || !current || isPaused) return;
      const next = buyPrestigeUpgrade(def, current, id);
      if (next !== current) replaceUniverse(activeId, next, true);
    },
    [activeId, def, isPaused, replaceUniverse]
  );

  const restart = useCallback(() => {
    const current = activeId ? saveRef.current?.universes[activeId] : undefined;
    if (!activeId || !def || !current) return;
    const next = endRun(def, current);
    if (next === current) return;
    replaceUniverse(activeId, next, true);
    setSeenTransitions(-1);
    setEndingDone(false);
  }, [activeId, def, replaceUniverse]);

  const replaceSave = useCallback(
    (next: SaveData) => {
      commit(next);
      persist();
      setRecovered(false);
      leave();
    },
    [commit, persist, leave]
  );

  const dismissOverlay = useCallback(() => {
    if (overlay === "ending") setEndingDone(true);
    else if (run) setSeenTransitions(run.transitions.length);
  }, [overlay, run]);

  return {
    save,
    recovered,
    activeId,
    def,
    universe,
    overlay,
    open,
    leave,
    tap,
    buyUpgrade,
    buyEmberUpgrade,
    dismissOverlay,
    restart,
    replaceSave,
  };
}
