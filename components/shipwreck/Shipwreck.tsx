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
import { playback, stageStory, startSpeed } from "@/lib/shipwreck/playback";
import {
  liveryOf,
  shipOf,
  whatIfOf,
  withLivery,
  withWhatIf,
  wreckOf,
} from "@/lib/shipwreck/save";
import { SHIP_IDS, getShip, specFor } from "@/lib/shipwreck/ships";
import { resolveLivery, type ShipId } from "@/lib/shipwreck/ships/types";
import {
  torpedoHitXs,
  torpedoHits,
  whatIfOpenings,
  whatIfRealIds,
} from "@/lib/shipwreck/sim/run";
import {
  endWords,
  firstHitS,
  historyNote,
  outcomeOf,
  showsNewEnding,
  storyEndT,
} from "@/lib/shipwreck/story";
import {
  TEST_HOOKS_ENABLED,
  installTestHooks,
  type ShipwreckModelHooks,
  type ShipwreckScreen,
} from "@/lib/shipwreck/testHooks";
import { resolveTime } from "@/lib/shipwreck/times";
import type { Speed } from "@/lib/shipwreck/types";
import {
  currentShipwreckSave,
  useShipwreckSave,
} from "@/lib/shipwreck/useSave";
import { useShipwreckSound } from "./audio/useShipwreckSound";
import { createSceneRuntime } from "./scene/runtime";
import { sceneHooks } from "./scene/sceneHooks";
import EndCard from "./ui/EndCard";
import Hud from "./ui/Hud";
import NightPanels from "./ui/NightPanels";
import ShipwreckErrorBoundary from "./ui/ShipwreckErrorBoundary";
import TitleScreen from "./ui/TitleScreen";
import WalkHud from "./ui/WalkHud";
import { useShipLivery } from "./useShipLivery";
import { useAtStoryEnd } from "./ui/useTimelineEnd";
import WhatIfEditor, {
  realWhatIfIds,
  type WhatIfChoice,
} from "./ui/WhatIfEditor";

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

type V3 = [number, number, number];
/**
 * Each wreck from above (ship frame): the Titanic's bow from its port side;
 * the Lusitania from over her port side, which faces up as she lies on her
 * starboard side (and still clear of the floor if she lands upright); the
 * Fitzgerald's upright bow, deep in the clay, from over its starboard side
 * and aft, toward the broken middle and her upturned stern beyond; the
 * Britannic on her starboard side as the Lusitania, from further off her
 * deck side (her funnel 1 lies on the floor there); the Concordia on her
 * side on the rocks, from over the sea off her stern quarter, Giglio
 * Porto's lights beyond her.
 */
const WRECK_VIEW: Record<ShipId, { target: V3; cam: V3 }> = {
  titanic: { target: [60, 0, 12], cam: [-20, -120, 50] },
  lusitania: { target: [40, 0, 10], cam: [-40, 60, 45] },
  fitzgerald: { target: [60, 0, 10], cam: [130, -95, 48] },
  // A placeholder until her scene (Task 6): her upright wreck from over
  // her port side.
  carpathia: { target: [30, 0, 8], cam: [-30, 80, 40] },
  // On her starboard side 120 m down, her port side up: from over it and
  // off her deck side, her bent bow and the funnel lying by her boat deck.
  britannic: { target: [30, 0, 14], cam: [-70, 70, 70] },
  // On her starboard side at 65°, her port side up: off her stern quarter,
  // out to sea and above (the frame rolls with her, so "up" is mostly +y,
  // "out to sea" mostly −z), the harbour's lights behind her.
  concordia: { target: [0, 0, 10], cam: [-190, 210, -100] },
  // Keel up on the 4,000 m floor, her hull up: from off her stern quarter
  // and above (the frame is turned over, so "up" is down the ship's z).
  poseidon: { target: [0, 0, 5], cam: [-170, 130, -100] },
};

/**
 * Another ship in her wreck (a crossover) lies however she landed: from
 * off her port quarter and well above, far enough back for her length.
 */
function crossoverWreckView(spec: { lbp: number }): { target: V3; cam: V3 } {
  const l = spec.lbp;
  return { target: [0, 0, 10], cam: [-0.45 * l, 0.5 * l, 0.3 * l] };
}

/** The save with no wreck chosen: her own. */
function withoutWreck<T extends { wreck?: ShipId }>(v: T): T {
  const out = { ...v };
  delete out.wreck;
  return out;
}

interface Run {
  id: number;
  ship: ShipId;
  /** The wreck she played (her own, or another ship's story). */
  wreck: ShipId;
  mode: RunMode;
  /** Compartments opened. */
  holes: number;
  /** The What if's choice (the real run's for a real one). */
  choice: WhatIfChoice;
  startedAtMs: number;
}

type Screen = "title" | "editor" | "night";

/**
 * Behind the title and the editor her run is only her opening moment: a
 * few seconds of sim, not her whole night (a storm ship's would run to
 * 8:25 PM).
 */
export const PREVIEW_END_S = 5;

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
  // The scene's runtime, shared with the walk controls over it.
  const runtime = useMemo(() => createSceneRuntime(), []);
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

  // The chosen ship: the save's (a 1.0 save has none: the Titanic).
  const ship = shipOf(save);
  // Her wreck: her own, or another ship's story (any ship in any wreck).
  const wreck = wreckOf(save);
  const spec = specFor(ship, wreck);
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  const screenRef = useRef<ShipwreckScreen>("title");
  useEffect(() => {
    screenRef.current = showEnd ? "end" : screen;
  });

  // Behind the title and the editor: the chosen ship, lit, before the
  // first event, slowly circled by the movie camera.
  // The ship is read from the save as it is now, not from this render: on
  // the first commit the save hook has just loaded it (its effect runs
  // first) but `ship` is still the server snapshot's Titanic, which would
  // build the Titanic once before a saved Lusitania.
  useEffect(() => {
    if (!isGame || screen === "night") return;
    const s = playback.getState();
    const now = currentShipwreckSave();
    const id = shipOf(now);
    const story = wreckOf(now);
    if (
      s.ship !== id ||
      stageStory(s) !== story ||
      s.track === null ||
      !s.preview ||
      s.openings.length > 0 ||
      s.t > 0
    ) {
      s.start(specFor(id, story), [], { endT: PREVIEW_END_S, preview: true });
      s.setXray(false);
      s.flyToPlace(null, false);
    }
    s.pause();
    s.setCamera("cinematic");
  }, [isGame, screen, ship, wreck]);

  const shipRef = useRef(ship);
  const wreckRef = useRef(wreck);
  useEffect(() => {
    shipRef.current = ship;
    wreckRef.current = wreck;
  });

  /** A ship card: her, in her own wreck (a crossover is chosen after). */
  const pickShip = useCallback(
    (id: ShipId) => {
      // Her own card again: keep the wreck chosen for her.
      if (id === shipRef.current && playback.getState().ship === id) return;
      update((v) => ({ ...withoutWreck(v), ship: id }));
      playback.getState().setShip(id);
      persist();
    },
    [update, persist]
  );
  /** A wreck card: the chosen ship in that ship's story. */
  const pickWreck = useCallback(
    (story: ShipId) => {
      const id = shipRef.current;
      update((v) =>
        story === shipOf(v) ? withoutWreck(v) : { ...v, wreck: story }
      );
      playback.getState().setShip(id, story);
      persist();
    },
    [update, persist]
  );

  const startRun = useCallback(
    (mode: RunMode, choice: WhatIfChoice) => {
      const s = playback.getState();
      const id = shipRef.current;
      const story = wreckRef.current;
      const runSpec = specFor(id, story);
      const openings =
        mode === "real"
          ? runSpec.realNight
          : whatIfOpenings(runSpec, choice.ids, choice.wave);
      const portholesOpen = mode === "real" || choice.portholesOpen !== false;
      const storm = mode === "real" ? "real" : (choice.storm ?? "real");
      // Each torpedo: where, when and on which side (`hits`, the x's aft
      // first, follow from them).
      const torpedoes = torpedoHits(
        runSpec,
        mode === "real" ? whatIfRealIds(runSpec) : choice.ids
      );
      // A mine ship's hits (no torpedo tracks: the HUD counts them), doors
      // and engines (R14); the other ships never get them, so their runs
      // stay exactly as they were.
      const mine =
        runSpec.cause === "mine"
          ? {
              hits: torpedoHitXs(
                runSpec,
                mode === "real" ? whatIfRealIds(runSpec) : choice.ids
              ),
              doorsClosed: mode === "whatif" && choice.doorsClosed === true,
              enginesStopped:
                mode === "whatif" && choice.enginesStopped === true,
            }
          : {};
      // A rocks ship's What-if toggle: the wind blows her out to sea.
      const toSea =
        runSpec.cause === "rocks" && mode === "whatif" && choice.toSea === true
          ? { toSea: true }
          : {};
      // A wave ship's wave (the What-if chip; the real night's is the real
      // one).
      const wave =
        runSpec.cause === "wave"
          ? {
              wave:
                mode === "real" ? ("real" as const) : (choice.wave ?? "real"),
            }
          : {};
      s.start(runSpec, openings, {
        portholesOpen,
        storm,
        torpedoes,
        ...mine,
        ...toSea,
        ...wave,
      });
      s.flyToPlace(null, false);
      s.setXray(false);
      s.setCamera("cinematic");
      s.setSpeed(
        startSpeed(runSpec, saveRef.current.settings.speed),
        -Infinity
      );
      s.play();
      const holes = new Set(openings.map((o) => o.compartmentId)).size;
      trackStart(mode, mode === "real" ? 0 : choice.ids.length, id);
      update((v) =>
        mode === "real"
          ? { ...v, seen: { ...v.seen, realNight: true } }
          : // A crossover's What if is not kept (her own spots differ).
            story !== id
            ? v
            : withWhatIf(v, id, choice)
      );
      setRun((r) => ({
        id: (r?.id ?? 0) + 1,
        ship: id,
        wreck: story,
        mode,
        holes,
        choice: { ...choice, ids: [...choice.ids] },
        startedAtMs: Date.now(),
      }));
      recorded.current = null;
      setEndDismissed(false);
      setNewEnding(false);
      setScreen("night");
    },
    [update]
  );

  // Her paint: the one saved for her (an unknown id, or none in an older
  // save: her default), applied whenever the ship changes.
  const savedLivery = useShipLivery(ship, liveryOf(save, ship));
  /** The paint button: remembered per ship (no analytics, R27). */
  const saveLivery = useCallback(
    (id: string) => {
      // The ship the save chose (the title's, and the run's).
      update((v) => withLivery(v, shipOf(v), id));
      persist();
    },
    [update, persist]
  );
  const chooseLivery = useCallback(
    (id: string) => {
      playback.getState().setLivery(id);
      saveLivery(id);
    },
    [saveLivery]
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
    trackEnd(run.mode, outcome, (sank?.realT ?? end) / 60, run.ship);
    const isNew = !saveRef.current.seen.endings.includes(outcome);
    // Seen only when its badge shows: her real run has none (R16), so it
    // must not quietly use up an ending she has not shown yet.
    // Another ship in her wreck is never her real run (R16 is about the
    // real Fitzgerald's loss): it counts as a What if.
    const shows = showsNewEnding(
      run.ship,
      run.wreck === run.ship ? run.mode : "whatif",
      isNew
    );
    setNewEnding(shows);
    if (shows)
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
    playback.getState().leaveWalk();
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
        // Minutes from the hit (a pre-roll counts as none).
        trackEnd(run.mode, outcome, Math.max(0, s.realT) / 60, run.ship);
      }
      recorded.current = run.id;
    }
    persist();
  }, [run, persist]);

  const leaveRef = useRef(leaveNight);
  useEffect(() => {
    leaveRef.current = leaveNight;
  });

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
      return installTestHooks(
        () => "scene",
        undefined,
        sceneHooks(playback, runtime)
      );
    return installTestHooks(
      () => screenRef.current,
      undefined,
      sceneHooks(playback, runtime),
      {
        setShip: (id) => {
          if (!(SHIP_IDS as readonly string[]).includes(id)) return;
          leaveRef.current();
          pickShip(id as ShipId);
          setScreen("title");
        },
        setWreck: (id) => {
          if (!(SHIP_IDS as readonly string[]).includes(id)) return;
          leaveRef.current();
          pickWreck(id as ShipId);
          setScreen("title");
        },
        ship: () => shipRef.current,
        startReal: () =>
          startRun("real", {
            ids: realWhatIfIds(specFor(shipRef.current, wreckRef.current)),
          }),
        startWhatIf: (
          ids,
          portholesOpen,
          storm,
          doorsClosed,
          enginesStopped,
          toSea,
          wave
        ) =>
          startRun("whatif", {
            ids,
            portholesOpen,
            ...(storm === "real" || storm === "calmer" || storm === "worse"
              ? { storm }
              : {}),
            ...(doorsClosed === true ? { doorsClosed } : {}),
            ...(enginesStopped === true ? { enginesStopped } : {}),
            ...(toSea === true ? { toSea } : {}),
            ...(wave === "real" || wave === "smaller" || wave === "ahead"
              ? { wave }
              : {}),
          }),
        getOutcome: () => {
          const s = playback.getState();
          return s.done && s.track ? outcomeOf(s.track) : null;
        },
        setLivery: (id) => {
          const own = getShip(playback.getState().ship);
          if (own.liveries?.some((l) => l.id === id)) chooseLivery(id);
        },
        livery: () => {
          const s = playback.getState();
          return resolveLivery(getShip(s.ship), s.livery);
        },
        setTime: (id) => {
          playback.getState().setTime(id === "real" ? null : id);
        },
        time: () => {
          const s = playback.getState();
          return resolveTime(stageStory(s), s.time);
        },
        setUnderLight: (level) => playback.getState().setUnderLight(level),
      }
    );
  }, [
    isModelView,
    isSceneView,
    startRun,
    pickShip,
    pickWreck,
    chooseLivery,
    runtime,
  ]);

  useVisibilityPause({ onPersist: persist });

  const soundOn = save.settings.sound;
  useShipwreckSound(playback, isGame && screen === "night", soundOn, runtime);
  const toggleSound = useCallback(() => {
    update((v) => ({ ...v, settings: { ...v.settings, sound: !soundOn } }));
    persist();
  }, [update, persist, soundOn]);

  const sound = useMemo(
    () => ({ isOn: soundOn, onToggle: toggleSound }),
    [soundOn, toggleSound]
  );
  const panels = useMemo(
    () => <NightPanels store={playback} spec={spec} />,
    [spec]
  );

  useGameServiceWorker("shipwreck");
  const { isUpdateReady, update: applyUpdate } = useGameUpdate("shipwreck", {
    saveNow: persist,
    serviceWorker: true,
  });

  if (isModelView && ModelViewer) return <ModelViewer hooksRef={modelHooks} />;
  if (isSceneView && SceneCheck) return <SceneCheck runtime={runtime} />;

  // At the end the run is done, so the track no longer changes.
  const endTrack = showEnd && hasTrack ? playback.getState().track : null;
  const runSpec = run ? specFor(run.ship, run.wreck) : spec;
  const words = endTrack
    ? endWords(endTrack, runSpec, run!.holes, {
        portholesOpen: run!.choice.portholesOpen,
        hits: playback.getState().hits.length,
        firstHitS: firstHitS(playback.getState().openings),
        storm: run!.mode === "real" ? "real" : run!.choice.storm,
        doorsClosed: run!.mode === "whatif" && run!.choice.doorsClosed,
        enginesStopped: run!.mode === "whatif" && run!.choice.enginesStopped,
        toSea: run!.mode === "whatif" && run!.choice.toSea,
        // Her mine at her real spot only (the Run for Kea lesson).
        realSpot:
          run!.mode === "real" ||
          run!.choice.ids.join() === whatIfRealIds(runSpec).join(),
      })
    : null;

  return (
    <GameShell className="bg-[#05080f] text-slate-100" testId="shipwreck-root">
      {/* safe-area-ok: the full-bleed 3D stage; the UI above pads itself */}
      <div className="absolute inset-0" data-testid="shipwreck-stage">
        <ShipwreckErrorBoundary>
          <NightScene store={playback} runtime={runtime} />
        </ShipwreckErrorBoundary>
      </div>
      {screen === "title" && (
        <TitleScreen
          ship={ship}
          onShip={pickShip}
          wreck={wreck}
          onWreck={pickWreck}
          onRealNight={() =>
            startRun("real", { ids: realWhatIfIds(spec), portholesOpen: true })
          }
          onWhatIf={() => setScreen("editor")}
          livery={savedLivery}
          onLivery={chooseLivery}
        />
      )}
      {screen === "editor" && (
        <WhatIfEditor
          key={`${ship}>${wreck}`}
          spec={spec}
          initial={
            wreck === ship ? whatIfOf(save, ship) : { ids: realWhatIfIds(spec) }
          }
          onBack={() => setScreen("title")}
          onGo={(choice) => startRun("whatif", choice)}
        />
      )}
      {screen === "night" && run && (
        <WalkHud store={playback} runtime={runtime} hidden={showEnd} />
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
          onLivery={saveLivery}
          savedLivery={savedLivery}
        />
      )}
      {words && (
        <EndCard
          words={words}
          history={historyNote(runSpec)}
          cause={runSpec.cause}
          isNew={newEnding}
          onLook={() => {
            setEndDismissed(true);
            // Afloat (even upside down): look around her, not at a wreck.
            if (words.outcome === "floated" || words.outcome === "capsized")
              playback.getState().setCamera("orbit");
            else
              playback
                .getState()
                .flyToView(
                  runSpec.story
                    ? crossoverWreckView(runSpec)
                    : WRECK_VIEW[runSpec.id]
                );
          }}
          onWatchAgain={() => startRun(run!.mode, run!.choice)}
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
