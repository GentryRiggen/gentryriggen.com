"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  buy,
  manualAction,
  manualGain,
  reconcileRun,
  tick,
} from "@/lib/little-machines/engine/engine";
import {
  buyPrestigeUpgrade,
  endRun,
  newUniverseSave,
} from "@/lib/little-machines/engine/prestige";
import { loadSave, writeSave } from "@/lib/little-machines/engine/save";
import type {
  SaveData,
  UniverseDef,
  UniverseSave,
} from "@/lib/little-machines/engine/types";
import { getPlayableUniverse } from "@/lib/little-machines/universes";

/** The sim and the readouts update this often; CSS handles smooth motion. */
const STEP_SECONDS = 0.1;
const AUTOSAVE_MS = 10_000;

/** What the player has to click through before play resumes. */
export type Overlay = "phase" | "ending" | null;

/** A universe save the current build can play (phase in range). */
function sanitize(def: UniverseDef, universe: UniverseSave): UniverseSave {
  return {
    ...universe,
    run: reconcileRun(def, universe.run, universe.prestigeUpgrades),
  };
}

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

  const persist = useCallback(() => {
    if (saveRef.current) writeSave(saveRef.current);
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
    },
    [replaceUniverse]
  );

  const leave = useCallback(() => {
    persist();
    setActiveId(null);
  }, [persist]);

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
      else {
        stop();
        persist();
      }
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
    window.addEventListener("pagehide", persist);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("pagehide", persist);
      persist();
    };
  }, [persist]);

  const tap = useCallback((): number => {
    const current = activeId ? saveRef.current?.universes[activeId] : undefined;
    if (!activeId || !def || !current) return 0;
    const gain = manualGain(def, current.run);
    const nextRun = manualAction(def, current.run);
    if (nextRun !== current.run)
      replaceUniverse(activeId, { ...current, run: nextRun });
    return gain;
  }, [activeId, def, replaceUniverse]);

  const buyUpgrade = useCallback(
    (id: string) => {
      const current = activeId
        ? saveRef.current?.universes[activeId]
        : undefined;
      if (!activeId || !def || !current) return;
      const nextRun = buy(def, current.run, id);
      if (nextRun !== current.run)
        replaceUniverse(activeId, { ...current, run: nextRun }, true);
    },
    [activeId, def, replaceUniverse]
  );

  const buyEmberUpgrade = useCallback(
    (id: string) => {
      const current = activeId
        ? saveRef.current?.universes[activeId]
        : undefined;
      if (!activeId || !def || !current) return;
      const next = buyPrestigeUpgrade(def, current, id);
      if (next !== current) replaceUniverse(activeId, next, true);
    },
    [activeId, def, replaceUniverse]
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
  };
}
