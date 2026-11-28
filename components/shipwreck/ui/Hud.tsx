"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { useStore } from "zustand";
import { SAFE_BOTTOM, SAFE_SIDES, SAFE_TOP } from "@/lib/game-kit/safeArea";
import { trackCamera } from "@/lib/shipwreck/analytics";
import { helpFor } from "@/lib/shipwreck/help";
import {
  interiorFor,
  openEntries,
  roomWaterTargets,
  type EntryIcon,
  type RoomEntry,
} from "@/lib/shipwreck/interior";
import { PLACES_BY_SHIP, type PlaceId } from "@/lib/shipwreck/places";
import { stageSpec, type PlaybackStore } from "@/lib/shipwreck/playback";
import { sampleTrack } from "@/lib/shipwreck/sim/track";
import { clockText, firstHitS, sinceText } from "@/lib/shipwreck/story";
import { walkMapFor } from "@/lib/shipwreck/walk";
import {
  CAMERA_IDS,
  SPEEDS,
  type CameraId,
  type Speed,
} from "@/lib/shipwreck/types";
import {
  requestWalkPlace,
  type SceneRuntime,
} from "@/components/shipwreck/scene/runtime";
import Captions from "./Captions";
import HelpCard from "./HelpCard";
import Icon, { type IconName } from "./Icon";
import BoatButton from "./BoatButton";
import LiveryButton from "./LiveryButton";
import TimeButton from "./TimeButton";
import Timeline from "./Timeline";
import WalkButton, { beginWalk } from "./WalkButton";
import { FOCUS, PANEL, ROUND, ROUND_ON } from "./styles";

export const CAMERA_LABEL: Record<CameraId, string> = {
  orbit: "Free look",
  bridge: "Bridge wing",
  stern: "Stern",
  lifeboat: "Lifeboat",
  underwater: "Under water",
  cinematic: "Movie camera",
  walk: "Walk the deck",
};

const CAMERA_ICON: Record<CameraId, IconName> = {
  orbit: "orbit",
  bridge: "bridge",
  stern: "stern",
  lifeboat: "lifeboat",
  underwater: "underwater",
  cinematic: "cinematic",
  walk: "walk",
};

/** A room entry's picture (the data names it; the HUD draws it). */
const ENTRY_ICON: Record<EntryIcon, IconName> = {
  staircase: "staircase",
  bed: "bed",
  bunk: "bunk",
  corridor: "corridor",
  atrium: "atrium-lift",
  stateroom: "stateroom",
  "low-cabin": "low-cabin",
  theatre: "theatre",
  "kids-club": "kids-club",
};

/**
 * The right rail's buttons: the Walk button (80 px) and the round ones
 * (64 px), 12 px apart, under 12 px of top padding.
 */
const RAIL_PAD_PX = 12;
const RAIL_GAP_PX = 12;
const RAIL_BUTTON_PX = 64;
const RAIL_WALK_PX = 80;

/**
 * How many of the rail's `n` buttons fit in one column in `height` px (the
 * middle band between the top and bottom bars), the Walk button first when
 * shown; at least one. Fewer than `n`: the rail goes into columns, so it
 * never runs under the speed buttons (a phone, home-screen insets).
 */
export function railRows(height: number, n: number, walkFirst: boolean) {
  const room = height - RAIL_PAD_PX + RAIL_GAP_PX;
  const first = (walkFirst ? RAIL_WALK_PX : RAIL_BUTTON_PX) + RAIL_GAP_PX;
  if (room < first) return 1;
  const rows = 1 + Math.floor((room - first) / (RAIL_BUTTON_PX + RAIL_GAP_PX));
  return Math.max(1, Math.min(n, rows));
}

/** The rail's grid rows by count, each its button's height (literal classes, for Tailwind). */
const RAIL_ROWS = [
  "grid-rows-[auto]",
  "grid-rows-[auto]",
  "grid-rows-[repeat(2,auto)]",
  "grid-rows-[repeat(3,auto)]",
  "grid-rows-[repeat(4,auto)]",
  "grid-rows-[repeat(5,auto)]",
] as const;

/** A box's height as it changes (null before the first measure, or with no layout). */
function useHeight(ref: RefObject<HTMLElement | null>): number | null {
  const [h, setH] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    // It reports once on observing, then on every change.
    const ro = new ResizeObserver(() => setH(el.clientHeight || null));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return h;
}

interface HudProps {
  store: PlaybackStore;
  onBack: () => void;
  onSpeed?: (speed: Speed) => void;
  /** The compartment diagram and stat chips (bottom left, collapsible). */
  side?: ReactNode;
  /** Chips under the clock. */
  chips?: ReactNode;
  /** A run id: captions reset with each run. */
  runId: number;
  /** The sound button (top of the right column); hidden when not given. */
  sound?: { isOn: boolean; onToggle: () => void };
  /** Hidden under the end card (kept mounted so captions and panels stay). */
  hidden?: boolean;
  /** The paint button chose a livery (the game remembers it). */
  onLivery?: (id: string) => void;
  /**
   * Her saved livery: what the paint button shows for the one frame before
   * the store has it (never the default's swatch for a ship wearing another).
   */
  savedLivery?: string | null;
  /**
   * The scene's runtime: with it, a ship with rooms gets room buttons in
   * the camera picker that start the walk standing inside (1.16).
   */
  runtime?: SceneRuntime;
  /** The save says the player has walked (the Walk button stops pulsing). */
  walked?: boolean;
  /** A walk started (any way): the save remembers it. */
  onWalked?: () => void;
}

/** The night's controls, all on the edges of the screen. */
export default function Hud({
  store,
  onBack,
  onSpeed,
  side,
  chips,
  runId,
  sound,
  hidden = false,
  onLivery,
  savedLivery = null,
  runtime,
  walked = false,
  onWalked,
}: HudProps) {
  const ship = stageSpec({
    ship: useStore(store, (s) => s.ship),
    wreck: useStore(store, (s) => s.wreck),
  });
  const realMinute = useStore(store, (s) => Math.floor(s.realT / 60));
  const hits = useStore(store, (s) => s.hits.length);
  // A first torpedo that comes later (the Carpathia's U-boat alone): the
  // clock's line counts down to it.
  const firstHit = useStore(store, (s) => firstHitS(s.openings));
  const playing = useStore(store, (s) => s.playing);
  const speed = useStore(store, (s) => s.speed);
  const camera = useStore(store, (s) => s.camera);
  const xray = useStore(store, (s) => s.xray);
  const place = useStore(store, (s) => s.place);
  const livery = useStore(store, (s) => s.livery) ?? savedLivery;
  // Walking: only play, speeds, the timeline (and sound) stay.
  const walking = camera === "walk";
  // "Walk the deck" is in the picker only for a ship you can walk on, and
  // (as the Walk button) needs a frame to stand on.
  const canWalk = walkMapFor(ship.id) !== null;
  const hasFrame = useStore(
    store,
    (s) => s.track !== null && s.track.frames.length > 0
  );
  const [panel, setPanel] = useState<"places" | "cameras" | null>(null);
  // Start inside: the rooms you can stand in right now, worked out only
  // while the picker is open (it re-renders each minute of the night).
  const interior = runtime ? interiorFor(ship.id) : null;
  const waterTarget = useMemo(
    () => (interior ? roomWaterTargets(ship) : null),
    [interior, ship]
  );
  const rooms: RoomEntry[] =
    panel === "cameras" && canWalk && interior && waterTarget && !walking
      ? roomsNow()
      : [];
  function roomsNow(): RoomEntry[] {
    const s = store.getState();
    const map = walkMapFor(ship.id);
    if (!interior || !waterTarget || !map || !s.track) return [];
    if (s.track.frames.length === 0) return [];
    return openEntries(interior, {
      map,
      spec: ship,
      frame: sampleTrack(s.track, s.t),
      target: waterTarget,
    });
  }
  const [help, setHelp] = useState(false);
  // The rail: one column where it fits, else columns (a phone).
  const middle = useRef<HTMLDivElement>(null);
  const middleH = useHeight(middle);
  const railN = (hidden ? 0 : 1) + (sound ? 1 : 0) + (walking ? 0 : 4);
  const rows = middleH === null ? railN : railRows(middleH, railN, !hidden);
  const railClass =
    rows < railN
      ? // Columns, the first at the edge (right to left; each button ltr).
        `grid grid-flow-col ${RAIL_ROWS[rows]} items-start justify-items-center gap-3 [direction:rtl] *:[direction:ltr]`
      : "flex flex-col items-end gap-3";
  // Her five rooms: a wider picker (one row of rooms) where width allows.
  const wide = rooms.length > 4;

  // Desktop nicety: Space plays/pauses, 1–4 pick a speed, ←/→ seek a minute.
  useEffect(() => {
    if (hidden) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest("button, input, textarea, [role=slider], [role=dialog]"))
        return;
      const s = store.getState();
      // On her deck Space jumps (WalkRunner's keys), not play/pause.
      if (e.key === " " && s.camera === "walk" && s.walk.phase === "deck")
        return;
      if (e.key === " ") {
        if (s.playing) s.pause();
        else s.play();
      } else if (e.key >= "1" && e.key <= "4") {
        const v = SPEEDS[Number(e.key) - 1];
        s.setSpeed(v);
        onSpeed?.(v);
      } else if (s.camera === "walk") {
        // Walking: the arrows walk (WalkRunner's keys), not seek.
        return;
      } else if (e.key === "ArrowRight") s.seek(s.t + 60);
      else if (e.key === "ArrowLeft") s.seek(s.t - 60);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store, onSpeed, hidden]);

  /** Starts a walk (the button, the picker, a room); true if it did. */
  const walkNow = (): boolean => {
    const ok = beginWalk(store);
    if (ok) onWalked?.();
    return ok;
  };
  const pickCamera = (id: CameraId) => {
    if (id === "walk") {
      // The Walk button's path: counted only once the walk started.
      walkNow();
      setPanel(null);
      return;
    }
    store.getState().flyToPlace(null, store.getState().xray);
    store.getState().setCamera(id);
    trackCamera(id);
    setPanel(null);
  };
  const pickRoom = (entry: RoomEntry) => {
    setPanel(null);
    // Still open now (the night may have moved on since the picker drew)?
    if (!runtime || !roomsNow().some((e) => e.id === entry.id)) return;
    if (!walkNow()) return;
    // The test hooks' path: inside, eyes, water, lights and torch as if
    // walked in.
    requestWalkPlace(runtime, entry.room, entry.at[0], entry.at[1], entry.yaw);
  };
  const pickPlace = (id: PlaceId) => {
    store.getState().flyToPlace(place === id ? null : id);
    setPanel(null);
  };

  return (
    <div
      data-testid="shipwreck-hud"
      aria-hidden={hidden || undefined}
      inert={hidden || undefined}
      className={`pointer-events-none absolute inset-0 flex flex-col ${
        hidden ? "invisible" : ""
      }`}
    >
      {/* Top bar: back, the ship's clock, help. */}
      <div
        className={`flex items-start justify-between gap-3 ${SAFE_TOP} ${SAFE_SIDES}`}
      >
        <div className="flex min-w-0 items-start gap-3">
          <button
            type="button"
            aria-label="Back to the title"
            data-testid="shipwreck-back"
            onClick={onBack}
            className={ROUND}
          >
            <Icon name="back" className="size-8" />
          </button>
          <div className="min-w-0">
            <div
              className={`${PANEL} inline-flex flex-col px-4 py-1.5`}
              aria-live="off"
            >
              <span
                data-testid="shipwreck-clock"
                className="text-3xl font-semibold tabular-nums leading-tight text-white sm:text-4xl"
              >
                {clockText(realMinute * 60, ship.clockStartS)}
              </span>
              <span className="text-sm text-slate-300 sm:text-base">
                {sinceText(realMinute * 60, ship, hits, firstHit)}
              </span>
            </div>
            {chips && <div className="mt-2">{chips}</div>}
          </div>
        </div>
        <div className="flex shrink-0 items-start gap-3">
          {/* The time of day and the water light (top, beside help: the
              right rail is full on a landscape iPad). */}
          {/* Walking: the walk controls own the top right. */}
          {!walking && !hidden && <BoatButton store={store} />}
          {!walking && <TimeButton store={store} spec={ship} />}
          <button
            type="button"
            aria-label="How to watch"
            data-testid="shipwreck-help-button"
            onClick={() => setHelp(true)}
            className={ROUND}
          >
            <Icon name="help" className="size-8" />
          </button>
        </div>
      </div>

      {/* Under an open picker the caption would cover its top row. */}
      <Captions key={runId} store={store} hidden={panel !== null && !walking} />

      {/* Middle: the right rail with X-ray, places and cameras. */}
      <div
        ref={middle}
        className={`relative flex min-h-0 flex-1 justify-end ${SAFE_SIDES}`}
      >
        <div className="flex min-h-0 flex-col items-end gap-3 pt-3">
          <div className="flex min-h-0 items-start gap-3">
            {panel === "places" && !walking && (
              <div
                className={`${PANEL} pointer-events-auto relative z-10 flex max-h-full flex-col gap-1.5 overflow-y-auto overscroll-contain p-2`}
                data-testid="shipwreck-places"
              >
                {PLACES_BY_SHIP[ship.id].map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    aria-label={`Fly to the ${label}`}
                    aria-pressed={place === id}
                    data-testid={`shipwreck-place-${id}`}
                    onClick={() => pickPlace(id)}
                    className={`flex min-h-14 items-center gap-2 rounded-xl px-3 text-left text-lg font-semibold ${
                      place === id
                        ? "bg-sky-500/85 text-white"
                        : "text-slate-100 hover:bg-white/10"
                    } ${FOCUS}`}
                  >
                    <Icon name="pin" className="size-6 shrink-0" />
                    {label}
                  </button>
                ))}
              </div>
            )}
            {panel === "cameras" && !walking && (
              <div
                className={`${PANEL} pointer-events-auto relative z-10 grid max-h-full grid-cols-2 gap-1.5 overflow-y-auto overscroll-contain p-2 max-sm:gap-1 short:sm:grid-cols-6 ${
                  wide ? "sm:grid-cols-3" : ""
                }`}
                data-testid="shipwreck-cameras"
              >
                {/* Walking: only on a ship with a walk map. */}
                {CAMERA_IDS.filter((id) => id !== "walk" || canWalk).map(
                  (id) => (
                    <button
                      key={id}
                      type="button"
                      aria-label={`Camera: ${CAMERA_LABEL[id]}`}
                      aria-pressed={camera === id}
                      data-testid={`shipwreck-camera-${id}`}
                      disabled={id === "walk" && !hasFrame}
                      onClick={() => pickCamera(id)}
                      className={`flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-sm font-semibold disabled:opacity-40 max-sm:min-h-14 short:sm:min-h-14 short:sm:text-xs ${
                        // With rooms, Walk the deck heads the walking row
                        // (on a short screen, the rooms' row).
                        id === "walk" && rooms.length > 0
                          ? wide
                            ? "col-span-2 sm:col-span-3 short:sm:col-span-1"
                            : "col-span-2 short:sm:col-span-1"
                          : "w-[5.5rem] sm:w-28 short:sm:w-[4.75rem]"
                      } ${
                        camera === id
                          ? "bg-sky-500/85 text-white"
                          : "text-slate-100 hover:bg-white/10"
                      } ${FOCUS}`}
                    >
                      <Icon
                        name={CAMERA_ICON[id]}
                        className="size-7 short:sm:size-6"
                      />
                      {CAMERA_LABEL[id]}
                    </button>
                  )
                )}
                {/* Start inside: pictures under Walk the deck, one row where
                    the picker is wide enough (her five: from sm, in three
                    columns, or six on a short screen beside Walk the
                    deck), four to a row on a phone. */}
                {rooms.length > 0 && (
                  <div
                    className={`col-span-full grid gap-1.5 max-sm:gap-1 short:sm:col-span-5 ${
                      wide ? "grid-cols-4 sm:grid-cols-5" : "grid-cols-4"
                    }`}
                    data-testid="shipwreck-rooms"
                  >
                    {rooms.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        aria-label={`Walk inside: ${entry.label}`}
                        data-testid={`shipwreck-room-${entry.id}`}
                        onClick={() => pickRoom(entry)}
                        className={`grid min-h-14 place-items-center rounded-xl border border-amber-300/40 bg-amber-400/15 text-amber-200 hover:bg-amber-400/25 max-sm:min-h-12 short:sm:min-h-14 ${FOCUS}`}
                      >
                        <Icon
                          name={ENTRY_ICON[entry.icon]}
                          className="size-8 sm:size-9"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className={railClass} data-testid="shipwreck-rail">
              {!hidden && (
                <WalkButton store={store} walked={walked} onWalked={onWalked} />
              )}
              {sound && (
                <button
                  type="button"
                  aria-label={sound.isOn ? "Sound on" : "Sound off"}
                  aria-pressed={sound.isOn}
                  data-testid="shipwreck-sound"
                  onClick={sound.onToggle}
                  className={sound.isOn ? ROUND_ON : ROUND}
                >
                  <Icon
                    name={sound.isOn ? "sound" : "mute"}
                    className="size-8"
                  />
                </button>
              )}
              {!walking && (
                <>
                  <LiveryButton
                    spec={ship}
                    livery={livery}
                    onChange={(id) => {
                      store.getState().setLivery(id);
                      onLivery?.(id);
                    }}
                  />
                  <button
                    type="button"
                    aria-label={
                      xray ? "X-ray off" : "X-ray on: see the water inside"
                    }
                    aria-pressed={xray}
                    data-testid="shipwreck-xray"
                    onClick={() => store.getState().setXray(!xray)}
                    className={xray ? ROUND_ON : ROUND}
                  >
                    <Icon name="xray" className="size-8" />
                  </button>
                  <button
                    type="button"
                    aria-label="Places to visit"
                    aria-expanded={panel === "places"}
                    data-testid="shipwreck-places-button"
                    onClick={() =>
                      setPanel(panel === "places" ? null : "places")
                    }
                    className={panel === "places" || place ? ROUND_ON : ROUND}
                  >
                    <Icon name="pin" className="size-8" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Cameras (now: ${CAMERA_LABEL[camera]})`}
                    aria-expanded={panel === "cameras"}
                    data-testid="shipwreck-cameras-button"
                    onClick={() =>
                      setPanel(panel === "cameras" ? null : "cameras")
                    }
                    className={panel === "cameras" ? ROUND_ON : ROUND}
                  >
                    <Icon name={CAMERA_ICON[camera]} className="size-8" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
        {side && !walking && (
          <div className="pointer-events-none absolute bottom-2 left-[max(1rem,env(safe-area-inset-left))] flex flex-col items-start gap-2">
            {side}
          </div>
        )}
      </div>

      {/* Bottom bar: play, speeds, the timeline. */}
      <div
        className={`flex flex-col gap-2 pt-2 sm:flex-row sm:items-end sm:gap-4 ${SAFE_BOTTOM} ${SAFE_SIDES}`}
      >
        <div className="pointer-events-auto flex items-center gap-1.5">
          <button
            type="button"
            aria-label={playing ? "Pause" : "Play"}
            data-testid="shipwreck-play"
            onClick={() =>
              playing ? store.getState().pause() : store.getState().play()
            }
            className={ROUND}
          >
            <Icon name={playing ? "pause" : "play"} className="size-8" />
          </button>
          <div
            role="group"
            aria-label="Speed"
            className={`${PANEL} flex gap-1 rounded-full p-1`}
          >
            {SPEEDS.map((v) => (
              <button
                key={v}
                type="button"
                aria-label={v === 1 ? "Real time" : `${v} times faster`}
                aria-pressed={speed === v}
                data-testid={`shipwreck-speed-${v}`}
                onClick={() => {
                  store.getState().setSpeed(v);
                  onSpeed?.(v);
                }}
                className={`size-16 touch-manipulation rounded-full text-lg font-semibold ${
                  speed === v
                    ? "bg-sky-500 text-white"
                    : "text-slate-200 hover:bg-white/10"
                } ${FOCUS}`}
              >
                ×{v}
              </button>
            ))}
          </div>
        </div>
        <Timeline store={store} />
      </div>

      {help && (
        <HelpCard
          help={helpFor("controls", null, ship)}
          icon="help"
          onClose={() => setHelp(false)}
        />
      )}
    </div>
  );
}
