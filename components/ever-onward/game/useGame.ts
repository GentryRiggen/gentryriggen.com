"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  buy,
  greetVisitor,
  isProjectId,
  manualAction,
  manualGain,
  performAction,
  reconcileRun,
  startProject,
  tick,
} from "@/lib/ever-onward/engine/engine";
import {
  buyPrestigeUpgrade,
  startOver,
  endRun,
  newUniverseSave,
} from "@/lib/ever-onward/engine/prestige";
import { isUniverseUnlocked } from "@/lib/ever-onward/engine/progress";
import { loadSave, writeSave } from "@/lib/ever-onward/engine/save";
import {
  stepMap,
  toggleArtifact as toggleArtifactOn,
} from "@/lib/ever-onward/engine/map";
import type {
  RunState,
  SaveData,
  UniverseDef,
  UniverseSave,
} from "@/lib/ever-onward/engine/types";
import { everOnwardSynth } from "../audio/everOnwardSynth";
import { getPlayableUniverse } from "@/lib/ever-onward/universes";
import type { JumpPoint } from "@/lib/ever-onward/test/jump";
import type { TestSpeed } from "@/lib/ever-onward/test/tester";

/** The sim and the readouts update this often; CSS handles smooth motion. */
const STEP_SECONDS = 0.1;
const AUTOSAVE_MS = 10_000;

/** Marks the history entry pushed when a game opens. */
const GAME_HISTORY_KEY = "everOnwardGame";

/** What the player has to click through before play resumes. */
/** How long the last moment plays before the ending screen (ms). */
const ENDING_BEAT_MS = 4500;

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

/** A test run (owner only): never saved, and the clock can run fast. */
export interface TestState {
  speed: TestSpeed;
}

export interface GameApi {
  /** Null until the save has been read on the client. */
  save: SaveData | null;
  recovered: boolean;
  /** The stored save is from a newer version; this build won't overwrite it. */
  hasNewerSave: boolean;
  activeId: string | null;
  def: UniverseDef | null;
  universe: UniverseSave | null;
  overlay: Overlay;
  open(id: string): void;
  leave(): void;
  /** Taps once; returns what the tap earned. */
  tap(): number;
  buyUpgrade(id: string): void;
  /** Does a universe action (buying oil) by hand. */
  doAction(id: string): void;
  /** Says hello to a waiting visitor: the gift is given, the logbook fills. */
  greet(id: string): void;
  /** Picks the lantern colour (1 to 3) the first ship will carry. */
  chooseLantern(lantern: number): void;
  buyEmberUpgrade(id: string): void;
  /** Remembers that the "restart for embers" card has been answered. */
  dismissEmberTip(): void;
  dismissOverlay(): void;
  /** Ends the run (finished, or restarted for embers) and starts a new one. */
  restart(): void;
  /** Starts the open universe again from its first part (from the menu). */
  startOver(): void;
  /** Map universes: count the finished run and play the next one on `key`. */
  stepTo(key: string): void;
  /** Map universes: switch a found artifact with a catch on or off. */
  toggleArtifact(id: string): void;
  /** Swaps in a whole save (from a backup code), writes it and shows the hub. */
  replaceSave(next: SaveData): void;
  /** Writes the save now (before a reload, for example). */
  saveNow(): void;
  /** Set while a test run is open (Test mode, owner only). */
  test: TestState | null;
  /** True while a jump is being played out. */
  isJumping: boolean;
  /** Opens a throwaway test run of part `phase` of a universe at `point`. */
  jumpTo(universeId: string, phase: number, point: JumpPoint): void;
  setTestSpeed(speed: TestSpeed): void;
  /** Leaves the test run and puts the real save back, untouched. */
  exitTest(): void;
}

export function useGame(): GameApi {
  const saveRef = useRef<SaveData | null>(null);
  const [save, setSave] = useState<SaveData | null>(null);
  const [recovered, setRecovered] = useState(false);
  const [hasNewerSave, setHasNewerSave] = useState(false);
  const isNewerSaveRef = useRef(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  /** Transitions the player has already seen; -1 shows the opening intro. */
  const [seenTransitions, setSeenTransitions] = useState(0);
  const [endingDone, setEndingDone] = useState(false);
  /** The ending screen waits a few seconds so the last moment can play out. */
  const [endingBeatDone, setEndingBeatDone] = useState(false);
  const [test, setTest] = useState<TestState | null>(null);
  const isTestRef = useRef(false);
  const speedRef = useRef<number>(1);
  /** The universe the real game had open when the first jump was made. */
  const realActiveRef = useRef<string | null>(null);
  const [isJumping, setIsJumping] = useState(false);

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
    // A test run is never written: the real save stays exactly as it was.
    if (isNewerSaveRef.current || isTestRef.current) return;
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
    const {
      save: loaded,
      recovered: wasRecovered,
      isFromNewerVersion,
    } = loadSave();
    isNewerSaveRef.current = !!isFromNewerVersion;
    saveRef.current = loaded;
    writtenRef.current = loaded;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSave(loaded);
    setRecovered(wasRecovered);
    setHasNewerSave(!!isFromNewerVersion);
  }, []);

  const open = useCallback(
    (id: string) => {
      const target = getPlayableUniverse(id);
      const current = saveRef.current;
      if (!target || !current || !isUniverseUnlocked(target, current)) return;
      const existing = current.universes[id];
      const ready = existing
        ? sanitize(target, existing)
        : newUniverseSave(target);
      replaceUniverse(id, ready, true);
      setSeenTransitions(isFresh(ready) ? -1 : ready.run.transitions.length);
      setEndingDone(ready.run.complete);
      setEndingBeatDone(ready.run.complete);
      setActiveId(id);
      // One history entry per game, so Back returns to the hub.
      window.history.pushState({ [GAME_HISTORY_KEY]: id }, "");
    },
    [replaceUniverse]
  );

  /** Ends a test run: the real save comes back from storage, untouched. */
  const restoreReal = useCallback((): SaveData | null => {
    if (!isTestRef.current) return null;
    const { save: real } = loadSave();
    isTestRef.current = false;
    speedRef.current = 1;
    saveRef.current = real;
    writtenRef.current = real;
    setSave(real);
    setTest(null);
    return real;
  }, []);

  const leave = useCallback(() => {
    restoreReal();
    realActiveRef.current = null;
    // Popping the game's history entry runs the popstate handler below.
    if (window.history.state?.[GAME_HISTORY_KEY]) {
      window.history.back();
      return;
    }
    persist();
    setActiveId(null);
  }, [persist, restoreReal]);

  // Browser Back (or Forward off the game's entry) returns to the hub.
  useEffect(() => {
    if (!activeId) return;
    const handlePopState = () => {
      restoreReal();
      realActiveRef.current = null;
      persist();
      setActiveId(null);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [activeId, persist, restoreReal]);

  const run = universe?.run ?? null;
  const overlay: Overlay = !run
    ? null
    : run.complete
      ? endingDone || !endingBeatDone
        ? null
        : "ending"
      : run.transitions.length > seenTransitions
        ? "phase"
        : null;
  const isPaused = overlay !== null;
  const isComplete = run?.complete ?? false;

  // The run is over, but the scene still has its last moment to play (the
  // flash, the boat turning for home) before the ending screen covers it.
  useEffect(() => {
    if (!isComplete || endingDone || endingBeatDone) return;
    const timer = window.setTimeout(
      () => setEndingBeatDone(true),
      ENDING_BEAT_MS
    );
    return () => window.clearTimeout(timer);
  }, [isComplete, endingDone, endingBeatDone]);

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
      // A fast test clock is played in steps the engine accepts (1s at most).
      let nextRun = current.run;
      let left = dt * speedRef.current;
      while (left > 0 && !nextRun.complete) {
        const slice = Math.min(1, left);
        nextRun = tick(def, nextRun, slice);
        left -= slice;
      }
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
    if (nextRun !== current.run) everOnwardSynth.tap(current.run.phase);
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
      if (nextRun !== current.run) {
        const upgrade = def.upgrades.find((u) => u.id === id);
        everOnwardSynth.buy(current.run.phase, (upgrade?.maxLevel ?? 1) <= 1);
      }
      if (nextRun !== current.run)
        replaceUniverse(activeId, { ...current, run: nextRun }, true);
    },
    [activeId, def, isPaused, replaceUniverse]
  );

  const doAction = useCallback(
    (id: string) => {
      const current = activeId
        ? saveRef.current?.universes[activeId]
        : undefined;
      if (!activeId || !def || !current || isPaused) return;
      // A project's start comes through here too (its panel calls onAct).
      const nextRun = isProjectId(def, id)
        ? startProject(def, current.run, id)
        : performAction(def, current.run, id);
      if (nextRun === current.run) return;
      everOnwardSynth.tap(current.run.phase);
      replaceUniverse(activeId, { ...current, run: nextRun });
    },
    [activeId, def, isPaused, replaceUniverse]
  );

  const greet = useCallback(
    (id: string) => {
      const current = activeId
        ? saveRef.current?.universes[activeId]
        : undefined;
      if (!activeId || !def || !current || isPaused) return;
      const nextRun = greetVisitor(def, current.run, id);
      if (nextRun === current.run) return;
      everOnwardSynth.buy(current.run.phase, true);
      replaceUniverse(activeId, { ...current, run: nextRun }, true);
    },
    [activeId, def, isPaused, replaceUniverse]
  );

  const chooseLantern = useCallback(
    (lantern: number) => {
      const current = activeId
        ? saveRef.current?.universes[activeId]
        : undefined;
      if (!activeId || !current) return;
      const run = current.run;
      replaceUniverse(
        activeId,
        {
          ...current,
          run: { ...run, resources: { ...run.resources, lantern } },
        },
        true
      );
    },
    [activeId, replaceUniverse]
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

  const dismissEmberTip = useCallback(() => {
    const current = activeId ? saveRef.current?.universes[activeId] : undefined;
    if (!activeId || !current || current.hasSeenEmberTip) return;
    replaceUniverse(activeId, { ...current, hasSeenEmberTip: true }, true);
  }, [activeId, replaceUniverse]);

  const restart = useCallback(() => {
    const current = activeId ? saveRef.current?.universes[activeId] : undefined;
    if (!activeId || !def || !current) return;
    const next = endRun(def, current);
    if (next === current) return;
    replaceUniverse(activeId, next, true);
    setSeenTransitions(-1);
    setEndingDone(false);
    setEndingBeatDone(false);
  }, [activeId, def, replaceUniverse]);

  const stepTo = useCallback(
    (key: string) => {
      const current = activeId
        ? saveRef.current?.universes[activeId]
        : undefined;
      if (!activeId || !def || !current) return;
      const next = stepMap(def, current, key);
      if (next === current) return;
      replaceUniverse(activeId, next, true);
      setSeenTransitions(-1);
      setEndingDone(false);
      setEndingBeatDone(false);
    },
    [activeId, def, replaceUniverse]
  );

  const toggleArtifact = useCallback(
    (id: string) => {
      const current = activeId
        ? saveRef.current?.universes[activeId]
        : undefined;
      if (!activeId || !def || !current) return;
      const next = toggleArtifactOn(def, current, id);
      if (next !== current) replaceUniverse(activeId, next, true);
    },
    [activeId, def, replaceUniverse]
  );

  const startOverRun = useCallback(() => {
    const current = activeId ? saveRef.current?.universes[activeId] : undefined;
    if (!activeId || !def || !current) return;
    replaceUniverse(activeId, startOver(def, current), true);
    setSeenTransitions(-1);
    setEndingDone(false);
    setEndingBeatDone(false);
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

  const jumpTo = useCallback(
    (universeId: string, phase: number, point: JumpPoint) => {
      const target = getPlayableUniverse(universeId);
      if (!target || !saveRef.current || isJumping) return;
      if (!isTestRef.current) {
        persist();
        realActiveRef.current = activeId;
      }
      setIsJumping(true);
      // Let "Getting there…" paint before the bot plays the run out.
      window.setTimeout(() => {
        void import("@/lib/ever-onward/test/bots")
          .then(({ jumpTo: playTo }) => {
            const run = playTo(universeId, phase, point);
            const current = saveRef.current;
            if (!run || !current) return;
            isTestRef.current = true;
            speedRef.current = speedRef.current || 1;
            const existing = current.universes[universeId];
            const universe: UniverseSave = {
              ...(existing ?? newUniverseSave(target)),
              run,
            };
            commit({
              ...current,
              universes: { ...current.universes, [universeId]: universe },
            });
            setTest((t) => t ?? { speed: 1 });
            // "Start" plays the part's intro; the others drop straight in.
            const seen = run.transitions.length;
            setSeenTransitions(
              point === "start" ? (phase === 0 ? -1 : seen - 1) : seen
            );
            setEndingDone(false);
            setEndingBeatDone(false);
            if (!activeId)
              window.history.pushState({ [GAME_HISTORY_KEY]: universeId }, "");
            setActiveId(universeId);
          })
          .finally(() => setIsJumping(false));
      }, 30);
    },
    [activeId, commit, isJumping, persist]
  );

  const setTestSpeed = useCallback((speed: TestSpeed) => {
    if (!isTestRef.current) return;
    speedRef.current = speed;
    setTest({ speed });
  }, []);

  const exitTest = useCallback(() => {
    const real = restoreReal();
    if (!real) return;
    const back = realActiveRef.current;
    realActiveRef.current = null;
    const backDef = back ? getPlayableUniverse(back) : undefined;
    const backSave = back ? real.universes[back] : undefined;
    if (back && backDef && backSave) {
      const ready = sanitize(backDef, backSave);
      saveRef.current = {
        ...real,
        universes: { ...real.universes, [back]: ready },
      };
      setSave(saveRef.current);
      setSeenTransitions(ready.run.transitions.length);
      setEndingDone(ready.run.complete);
      setEndingBeatDone(ready.run.complete);
      setActiveId(back);
    } else {
      leave();
    }
  }, [leave, restoreReal]);

  return {
    save,
    recovered,
    hasNewerSave,
    activeId,
    def,
    universe,
    overlay,
    open,
    leave,
    tap,
    buyUpgrade,
    doAction,
    greet,
    chooseLantern,
    buyEmberUpgrade,
    dismissEmberTip,
    dismissOverlay,
    restart,
    startOver: startOverRun,
    replaceSave,
    saveNow: persist,
    test,
    isJumping,
    jumpTo,
    stepTo,
    toggleArtifact,
    setTestSpeed,
    exitTest,
  };
}
