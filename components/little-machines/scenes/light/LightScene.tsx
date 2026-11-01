"use client";

import { useEffect, useState } from "react";
import type { RunState } from "@/lib/little-machines/engine/types";
import { sceneInfo } from "@/lib/little-machines/universes/light";
import CoastLayer from "./CoastLayer";
import LastLayer from "./LastLayer";
import NightLayer from "./NightLayer";
import SkyLayer from "./SkyLayer";

interface LightSceneProps {
  run: RunState;
}

const LAYERS = [CoastLayer, NightLayer, SkyLayer, LastLayer] as const;
const CAPTIONS = [
  "A lighthouse sweeping its beam over a dark sea",
  "The planet at night, its cities lighting up",
  "The sun with collectors around it, and the stars",
  "One small lantern in the dark",
] as const;
/** How long an old layer stays drawn while it fades out. */
const FADE_MS = 2200;

interface Visual {
  /** The layer that is faded in. */
  shown: number;
  /** The layer fading out, if any. */
  leaving: number | null;
}

/**
 * The Keep the Light On scene. Each phase is a layer; on a phase change the
 * old layer shrinks away (the camera pulls back) while the new one settles in.
 */
export default function LightScene({ run }: LightSceneProps) {
  const info = sceneInfo(run);
  const target = Math.min(LAYERS.length - 1, Math.max(0, info.phaseIndex));
  const [visual, setVisual] = useState<Visual>({
    shown: target,
    leaving: null,
  });

  useEffect(() => {
    if (visual.shown === target) return;
    // Two frames so the new layer mounts hidden first, then fades in.
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() =>
        setVisual({ shown: target, leaving: visual.shown })
      );
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [target, visual.shown]);

  useEffect(() => {
    if (visual.leaving === null) return;
    const timer = window.setTimeout(
      () => setVisual((v) => ({ ...v, leaving: null })),
      FADE_MS
    );
    return () => window.clearTimeout(timer);
  }, [visual.leaving]);

  const drawn = new Set([target, visual.shown, visual.leaving]);

  return (
    <svg
      viewBox="0 0 400 300"
      role="img"
      aria-label={CAPTIONS[target]}
      data-testid="lm-scene"
      data-phase={info.phase}
      overflow="visible"
      className="block h-full w-full"
    >
      <defs>
        <linearGradient id="lm-beam" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff3b0" stopOpacity="0.95" />
          <stop offset="1" stopColor="#fff3b0" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="lm-lamp">
          <stop offset="0" stopColor="#ffe9a0" stopOpacity="0.95" />
          <stop offset="0.4" stopColor="#ffd45e" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ffd45e" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="lm-sun">
          <stop offset="0" stopColor="#ffd35a" stopOpacity="0.9" />
          <stop offset="0.35" stopColor="#ff9f3a" stopOpacity="0.3" />
          <stop offset="1" stopColor="#ff9f3a" stopOpacity="0" />
        </radialGradient>
        <linearGradient
          id="lm-coast-sky"
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="20"
          x2="0"
          y2="190"
        >
          <stop offset="0" stopColor="#070b1f" />
          <stop offset="1" stopColor="#22377a" />
        </linearGradient>
        <linearGradient
          id="lm-sea"
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="190"
          x2="0"
          y2="300"
        >
          <stop offset="0" stopColor="#173f6e" />
          <stop offset="1" stopColor="#07162b" />
        </linearGradient>
        <linearGradient
          id="lm-dawn"
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2="0"
          y2="190"
        >
          <stop offset="0" stopColor="#2b4fa8" />
          <stop offset="1" stopColor="#ffb26b" />
        </linearGradient>
        <radialGradient id="lm-planet" cx="0.5" cy="0.15" r="0.6">
          <stop offset="0" stopColor="#14355c" />
          <stop offset="1" stopColor="#050d1d" />
        </radialGradient>
        <g id="lm-mini">
          <polygon points="-13,0 13,0 8,-113 -8,-113" fill="#e9e4d6" />
          <polygon points="-11,-45 11,-45 9.5,-70 -9.5,-70" fill="#b7413b" />
          <rect x="-8.5" y="-118" width="17" height="5" fill="#2b2f3d" />
          <rect x="-7" y="-132" width="14" height="14" fill="#ffd76a" />
          <polygon points="-10,-132 10,-132 0,-144" fill="#2b2f3d" />
        </g>
      </defs>
      {LAYERS.map((Layer, index) => {
        if (!drawn.has(index)) return null;
        const isShown = index === visual.shown;
        const state = isShown
          ? "opacity-100 scale-100"
          : index < visual.shown
            ? "opacity-0 scale-50"
            : "opacity-0 scale-150";
        return (
          <g
            key={index}
            className={`origin-[200px_150px] transition-[opacity,scale] duration-[2000ms] ease-in-out motion-reduce:transition-none ${state}`}
          >
            <Layer info={info} />
          </g>
        );
      })}
    </svg>
  );
}
