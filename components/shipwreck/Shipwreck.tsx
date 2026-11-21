"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useStore } from "zustand";
import GameShell from "@/components/game-kit/GameShell";
import { useGameServiceWorker } from "@/components/game-kit/useGameServiceWorker";
import { useGameUpdate } from "@/components/game-kit/useGameUpdate";
import useVisibilityPause from "@/components/game-kit/useVisibilityPause";
import UpdatePill from "@/components/update/UpdatePill";
import { trackEnd, trackStart, type RunMode } from "@/lib/shipwreck/analytics";
import { playback } from "@/lib/shipwreck/playback";
import { titanic } from "@/lib/shipwreck/ships/titanic";
import { whatIfOpenings } from "@/lib/shipwreck/sim/run";
import { endWords, outcomeOf, storyEndT } from "@/lib/shipwreck/story";
import {
  TEST_HOOKS_ENABLED,
  installTestHooks,
  type ShipwreckModelHooks,
  type ShipwreckScreen,
} from "@/lib/shipwreck/testHooks";
import type { Speed } from "@/lib/shipwreck/types";
import { useShipwreckSave } from "@/lib/shipwreck/useSave";
import { useShipwreckSound } from "./audio/useShipwreckSound";
import { sceneHooks } from "./scene/sceneHooks";
import EndCard from "./ui/EndCard";
import Hud from "./ui/Hud";
import NightPanels from "./ui/NightPanels";
import ShipwreckErrorBoundary from "./ui/ShipwreckErrorBoundary";
import TitleScreen from "./ui/TitleScreen";
import { useAtStoryEnd } from "./ui/useTimelineEnd";
import WhatIfEditor, { REAL_NIGHT_IDS } from "./ui/WhatIfEditor";

// The model viewer (`/shipwreck?model`) and the scene check
// (`/shipwreck?scene`) are for checking the 3D in dev and e2e builds; the
// shipped build never loads them (the gate lets the bundler drop them).
const ModelViewer = TEST_HOOKS_ENABLED
  ? dynamic(() => import("./model/ModelViewer"), { ssr: false })
  : null;
const SceneCheck = TEST_HOOKS_ENABLED
  ? dynamic(() => import("./scene/SceneCheck"), { ssr: false })
  : null;
const NightScene = dynamic(() => import("./scene/NightScene"), { ssr: false });

const noSubscribe = () => () => {};
function readFlag(name: string): boolean {
  return (
    TEST_HOOKS_ENABLED && new URLSearchParams(window.location.search).has(name)
  );
}
const readModelFlag = () => readFlag("model");
const readSceneFlag = () => readFlag("scene");

/** The wreck from above the bow's port side (ship frame, on the bow). */
const WRECK_VIEW = {
  target: [60, 0, 12] as [number, number, number],
  cam: [-20, -120, 50] as [number, number, number],
};

interface Run {
  id: number;
  mode: RunMode;
  /** Compartments opened. */
  holes: number;
  startedAtMs: number;
}

type Screen = "title" | "editor" | "night";

export default function Shipwreck() {
  const { save, update, persist } = useShipwreckSave();
  const isModelView = useSyncExternalStore(
    noSubscribe,
    readModelFlag,
    () => false
  );
  const isSceneView = useSyncExternalStore(
    noSubscribe,
    readSceneFlag,
    () => false
  );
  const modelHooks = useRef<ShipwreckModelHooks | null>(null);
  const isGame = !isModelView && !isSceneView;

  const [screen, setScreen] = useState<Screen>("title");
  const [run, setRun] = useState<Run | null>(null);
  const [endDismissed, setEndDismissed] = useState(false);
  const [newEnding, setNewEnding] = useState(false);
  const recorded = useRef<number | null>(null);
  const atEnd = useAtStoryEnd(playback);
  // Only whether there is a track: the runner stores a new track object
  // every frame while it computes, which would re-render everything.
  const hasTrack = useStore(playback, (s) => s.track !== null);
  const showEnd = screen === "night" && run !== null && atEnd && !endDismissed;

  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  const screenRef = useRef<ShipwreckScreen>("title");
  useEffect(() => {
    screenRef.current = showEnd ? "end" : screen;
  });

  // Behind the title and the editor: the lit ship before the collision,
  // slowly circled by the movie camera.
  useEffect(() => {
    if (!isGame || screen === "night") return;
    const s = playback.getState();
    if (s.track === null || s.openings.length > 0 || s.t > 0) {
      s.start(titanic, []);
      s.setXray(false);
      s.flyToPlace(null, false);
    }
    s.pause();
    s.setCamera("cinematic");
  }, [isGame, screen]);

  const startRun = useCallback(
    (mode: RunMode, ids: readonly string[]) => {
      const s = playback.getState();
      const openings =
        mode === "real" ? titanic.realNight : whatIfOpenings(titanic, ids);
      s.start(titanic, openings);
      s.flyToPlace(null, false);
      s.setXray(false);
      s.setCamera("cinematic");
      s.setSpeed(saveRef.current.settings.speed, -Infinity);
      s.play();
      const holes = new Set(openings.map((o) => o.compartmentId)).size;
      trackStart(mode, mode === "real" ? 0 : ids.length);
      update((v) =>
        mode === "real"
          ? { ...v, seen: { ...v.seen, realNight: true } }
          : { ...v, lastWhatIf: [...ids] }
      );
      setRun((r) => ({
        id: (r?.id ?? 0) + 1,
        mode,
        holes,
        startedAtMs: Date.now(),
      }));
      recorded.current = null;
      setEndDismissed(false);
      setNewEnding(false);
      setScreen("night");
    },
    [update]
  );

  // The end: record the ending once per run.
  useEffect(() => {
    if (!run || !atEnd || recorded.current === run.id) return;
    const tr = playback.getState().track;
    if (!tr) return;
    recorded.current = run.id;
    playback.getState().pause();
    const outcome = outcomeOf(tr);
    const end = storyEndT(tr, true) ?? tr.endT;
    const sank = tr.events.find((e) => e.kind === "stern-under");
    trackEnd(run.mode, outcome, (sank?.realT ?? end) / 60);
    const isNew = !saveRef.current.seen.endings.includes(outcome);
    setNewEnding(isNew);
    if (isNew)
      update((v) => ({
        ...v,
        seen: { ...v.seen, endings: [...v.seen.endings, outcome] },
      }));
    persist();
  }, [atEnd, run, update, persist]);

  // After "Look at the wreck", going back in time (Play from the end, or a
  // scrub) brings the end card back when the story ends again.
  useEffect(
    () =>
      playback.subscribe((s, prev) => {
        if (s.t < prev.t - 1) setEndDismissed(false);
      }),
    []
  );

  const leaveNight = useCallback(() => {
    const s = playback.getState();
    if (run && recorded.current !== run.id) {
      // Left before the end: count it if they watched a minute or more.
      if (Date.now() - run.startedAtMs >= 60_000) {
        const outcome =
          s.track?.sankAtT !== null &&
          s.track?.sankAtT !== undefined &&
          s.t >= s.track.sankAtT
            ? "sank"
            : "floated";
        trackEnd(run.mode, outcome, s.realT / 60);
      }
      recorded.current = run.id;
    }
    persist();
  }, [run, persist]);

  const goTitle = useCallback(() => {
    leaveNight();
    setScreen("title");
  }, [leaveNight]);
  const goEditor = useCallback(() => {
    leaveNight();
    setScreen("editor");
  }, [leaveNight]);

  const onSpeed = useCallback(
    (speed: Speed) =>
      update((v) => ({ ...v, settings: { ...v.settings, speed } })),
    [update]
  );

  useEffect(() => {
    if (isModelView)
      return installTestHooks(
        () => "model",
        () => modelHooks.current
      );
    if (isSceneView)
      return installTestHooks(() => "scene", undefined, sceneHooks(playback));
    return installTestHooks(
      () => screenRef.current,
      undefined,
      sceneHooks(playback),
      {
        startReal: () => startRun("real", REAL_NIGHT_IDS),
        startWhatIf: (ids) => startRun("whatif", ids),
        getOutcome: () => {
          const s = playback.getState();
          return s.done && s.track ? outcomeOf(s.track) : null;
        },
      }
    );
  }, [isModelView, isSceneView, startRun]);

  useVisibilityPause({ onPersist: persist });

  const soundOn = save.settings.sound;
  useShipwreckSound(playback, isGame && screen === "night", soundOn);
  const toggleSound = useCallback(() => {
    update((v) => ({ ...v, settings: { ...v.settings, sound: !soundOn } }));
    persist();
  }, [update, persist, soundOn]);

  const sound = useMemo(
    () => ({ isOn: soundOn, onToggle: toggleSound }),
    [soundOn, toggleSound]
  );
  const panels = useMemo(
    () => <NightPanels store={playback} spec={titanic} />,
    []
  );

  useGameServiceWorker("shipwreck");
  const { isUpdateReady, update: applyUpdate } = useGameUpdate("shipwreck", {
    saveNow: persist,
    serviceWorker: true,
  });

  if (isModelView && ModelViewer) return <ModelViewer hooksRef={modelHooks} />;
  if (isSceneView && SceneCheck) return <SceneCheck />;

  // At the end the run is done, so the track no longer changes.
  const endTrack = showEnd && hasTrack ? playback.getState().track : null;
  const words = endTrack
    ? endWords(endTrack, titanic.name, titanic.seaDepthM, run!.holes)
    : null;

  return (
    <GameShell className="bg-[#05080f] text-slate-100" testId="shipwreck-root">
      {/* safe-area-ok: the full-bleed 3D stage; the UI above pads itself */}
      <div className="absolute inset-0" data-testid="shipwreck-stage">
        <ShipwreckErrorBoundary>
          <NightScene store={playback} />
        </ShipwreckErrorBoundary>
      </div>
      {screen === "title" && (
        <TitleScreen
          onRealNight={() => startRun("real", REAL_NIGHT_IDS)}
          onWhatIf={() => setScreen("editor")}
        />
      )}
      {screen === "editor" && (
        <WhatIfEditor
          initial={save.lastWhatIf}
          onBack={() => setScreen("title")}
          onGo={(ids) => startRun("whatif", ids)}
        />
      )}
      {screen === "night" && run && (
        <Hud
          key={run.id}
          runId={run.id}
          store={playback}
          onBack={goTitle}
          onSpeed={onSpeed}
          sound={sound}
          side={panels}
          hidden={showEnd}
        />
      )}
      {words && (
        <EndCard
          words={words}
          isNew={newEnding}
          onLook={() => {
            setEndDismissed(true);
            if (words.outcome === "floated")
              playback.getState().setCamera("orbit");
            else playback.getState().flyToView(WRECK_VIEW);
          }}
          onWatchAgain={() =>
            startRun(
              run!.mode,
              run!.mode === "real" ? REAL_NIGHT_IDS : save.lastWhatIf
            )
          }
          onWhatIf={goEditor}
        />
      )}
      {isUpdateReady && (
        <UpdatePill
          onUpdate={applyUpdate}
          testId="shipwreck-update"
          className={`pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4`}
          buttonClassName="pointer-events-auto min-h-16 touch-manipulation rounded-full border border-sky-400 bg-slate-900 px-6 py-3 text-lg font-semibold text-sky-200 shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
        />
      )}
    </GameShell>
  );
}
