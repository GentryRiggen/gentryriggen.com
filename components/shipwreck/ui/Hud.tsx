"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useStore } from "zustand";
import { SAFE_BOTTOM, SAFE_SIDES, SAFE_TOP } from "@/lib/game-kit/safeArea";
import { trackCamera } from "@/lib/shipwreck/analytics";
import { helpFor } from "@/lib/shipwreck/help";
import { PLACE_IDS, PLACES, type PlaceId } from "@/lib/shipwreck/places";
import type { PlaybackStore } from "@/lib/shipwreck/playback";
import { clockText, sinceText } from "@/lib/shipwreck/story";
import {
  CAMERA_IDS,
  SPEEDS,
  type CameraId,
  type Speed,
} from "@/lib/shipwreck/types";
import Captions from "./Captions";
import HelpCard from "./HelpCard";
import Icon, { type IconName } from "./Icon";
import Timeline from "./Timeline";
import { FOCUS, PANEL, ROUND, ROUND_ON } from "./styles";

export const CAMERA_LABEL: Record<CameraId, string> = {
  orbit: "Free look",
  bridge: "Bridge wing",
  stern: "Stern",
  lifeboat: "Lifeboat",
  underwater: "Under water",
  cinematic: "Movie camera",
};

const CAMERA_ICON: Record<CameraId, IconName> = {
  orbit: "orbit",
  bridge: "bridge",
  stern: "stern",
  lifeboat: "lifeboat",
  underwater: "underwater",
  cinematic: "cinematic",
};

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
}: HudProps) {
  const realMinute = useStore(store, (s) => Math.floor(s.realT / 60));
  const playing = useStore(store, (s) => s.playing);
  const speed = useStore(store, (s) => s.speed);
  const camera = useStore(store, (s) => s.camera);
  const xray = useStore(store, (s) => s.xray);
  const place = useStore(store, (s) => s.place);
  const [panel, setPanel] = useState<"places" | "cameras" | null>(null);
  const [help, setHelp] = useState(false);

  // Desktop nicety: Space plays/pauses, 1–4 pick a speed, ←/→ seek a minute.
  useEffect(() => {
    if (hidden) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest("button, input, textarea, [role=slider], [role=dialog]"))
        return;
      const s = store.getState();
      if (e.key === " ") {
        if (s.playing) s.pause();
        else s.play();
      } else if (e.key >= "1" && e.key <= "4") {
        const v = SPEEDS[Number(e.key) - 1];
        s.setSpeed(v);
        onSpeed?.(v);
      } else if (e.key === "ArrowRight") s.seek(s.t + 60);
      else if (e.key === "ArrowLeft") s.seek(s.t - 60);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store, onSpeed, hidden]);

  const pickCamera = (id: CameraId) => {
    store.getState().flyToPlace(null, store.getState().xray);
    store.getState().setCamera(id);
    trackCamera(id);
    setPanel(null);
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
                {clockText(realMinute * 60)}
              </span>
              <span className="text-sm text-slate-300 sm:text-base">
                {sinceText(realMinute * 60)}
              </span>
            </div>
            {chips && <div className="mt-2">{chips}</div>}
          </div>
        </div>
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

      <Captions key={runId} store={store} />

      {/* Middle: the right rail with X-ray, places and cameras. */}
      <div className={`relative flex min-h-0 flex-1 justify-end ${SAFE_SIDES}`}>
        <div className="flex flex-col items-end gap-3 pt-3">
          <div className="flex items-start gap-3">
            {panel === "places" && (
              <div
                className={`${PANEL} pointer-events-auto flex flex-col gap-1.5 p-2`}
                data-testid="shipwreck-places"
              >
                {PLACE_IDS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    aria-label={`Fly to the ${PLACES[id].label}`}
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
                    {PLACES[id].label}
                  </button>
                ))}
              </div>
            )}
            {panel === "cameras" && (
              <div
                className={`${PANEL} pointer-events-auto grid grid-cols-2 gap-1.5 p-2`}
                data-testid="shipwreck-cameras"
              >
                {CAMERA_IDS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    aria-label={`Camera: ${CAMERA_LABEL[id]}`}
                    aria-pressed={camera === id}
                    data-testid={`shipwreck-camera-${id}`}
                    onClick={() => pickCamera(id)}
                    className={`flex min-h-16 w-24 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-sm font-semibold sm:w-28 ${
                      camera === id
                        ? "bg-sky-500/85 text-white"
                        : "text-slate-100 hover:bg-white/10"
                    } ${FOCUS}`}
                  >
                    <Icon name={CAMERA_ICON[id]} className="size-7" />
                    {CAMERA_LABEL[id]}
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-col gap-3">
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
                onClick={() => setPanel(panel === "places" ? null : "places")}
                className={panel === "places" || place ? ROUND_ON : ROUND}
              >
                <Icon name="pin" className="size-8" />
              </button>
              <button
                type="button"
                aria-label={`Cameras (now: ${CAMERA_LABEL[camera]})`}
                aria-expanded={panel === "cameras"}
                data-testid="shipwreck-cameras-button"
                onClick={() => setPanel(panel === "cameras" ? null : "cameras")}
                className={panel === "cameras" ? ROUND_ON : ROUND}
              >
                <Icon name={CAMERA_ICON[camera]} className="size-8" />
              </button>
            </div>
          </div>
        </div>
        {side && (
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
          help={helpFor("controls", null)}
          icon="help"
          onClose={() => setHelp(false)}
        />
      )}
    </div>
  );
}
