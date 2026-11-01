"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { showcaseAt, showcaseRun } from "@/lib/ever-onward/engine/cutscene";
import type { UniverseDef } from "@/lib/ever-onward/engine/types";
import { cutClipId } from "@/lib/ever-onward/narration/lines";
import ListenButton from "../narration/ListenButton";
import { stopNarration } from "../narration/player";
import type { SceneProps } from "../universes/types";
import { useReducedMotion } from "./useAnimatedNumber";
import CrtOverlay from "./retro/CrtOverlay";
import RetroHeading from "./retro/RetroHeading";
import {
  pixelClass,
  retroLabelClass,
  retroPanelClass,
  retroPrimaryButtonClass,
  retroSecondaryButtonClass,
} from "./retro/retroStyles";

interface PhaseCutsceneProps {
  def: UniverseDef;
  phaseIndex: number;
  Scene: ComponentType<SceneProps>;
  /** Called by the last frame's button. */
  onContinue: () => void;
  /** What the last frame's button says (Start for a new part, Done to re-watch). */
  finishLabel?: string;
  /** The opening of a new run may ask a question (see `UniverseUi.Opening`). */
  opening?: ReactNode;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** A slow pan or zoom for each frame's picture. */
const PANS = [
  "lm-cut-pan-a origin-bottom-left",
  "lm-cut-pan-b origin-top-right",
  "lm-cut-pan-a origin-center",
  "lm-cut-pan-b origin-bottom",
] as const;

/**
 * The short cutscene that plays when a part begins: where you are, what you
 * do and why, how to do well, and your goal. It is shared by every universe;
 * the words and the picture come from the phase and the universe's Scene.
 */
export default function PhaseCutscene({
  def,
  phaseIndex,
  Scene,
  onContinue,
  finishLabel = "Start",
  opening,
}: PhaseCutsceneProps) {
  const phase = def.phases[phaseIndex];
  const frames = useMemo(
    () =>
      phase.cutscene?.length
        ? phase.cutscene
        : [{ text: phase.intro ?? phase.title }],
    [phase]
  );
  const last = Math.max(0, frames.length - 1);
  const [index, setIndex] = useState(0);
  const isReduced = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const onContinueRef = useRef(onContinue);
  const indexRef = useRef(index);
  useEffect(() => {
    onContinueRef.current = onContinue;
    indexRef.current = index;
  });

  const showcase = showcaseAt(frames, index);
  const run = useMemo(
    () => showcaseRun(def, phaseIndex, showcase),
    [def, phaseIndex, showcase]
  );

  const go = (to: number) => {
    stopNarration();
    setIndex(Math.min(last, Math.max(0, to)));
  };
  const goRef = useRef(go);
  useEffect(() => {
    goRef.current = go;
  });

  // Focus the main button on open; give focus back when the cutscene closes.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    primaryRef.current?.focus();
    return () => {
      stopNarration();
      before?.focus?.();
    };
  }, []);

  // A button that vanished (Skip on the last frame) must not take focus along.
  useEffect(() => {
    if (!rootRef.current?.contains(document.activeElement)) {
      primaryRef.current?.focus();
    }
  }, [index]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const now = indexRef.current;
      if (event.key === "ArrowRight" && now < last) {
        event.preventDefault();
        goRef.current(now + 1);
      } else if (event.key === "ArrowLeft" && now > 0) {
        event.preventDefault();
        goRef.current(now - 1);
      } else if (event.key === "Enter") {
        // A focused button already activates itself on Enter.
        const target = event.target as HTMLElement | null;
        if (target?.closest("button")) return;
        event.preventDefault();
        if (now < last) goRef.current(now + 1);
        else onContinueRef.current();
      } else if (event.key === "Tab") {
        const nodes = rootRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
        if (!nodes || nodes.length === 0) return;
        const first = nodes[0];
        const end = nodes[nodes.length - 1];
        const active = document.activeElement;
        if (!rootRef.current?.contains(active)) {
          event.preventDefault();
          first.focus();
        } else if (event.shiftKey && active === first) {
          event.preventDefault();
          end.focus();
        } else if (!event.shiftKey && active === end) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [last]);

  const frame = frames[index];
  const isLast = index === last;
  const pan = PANS[index % PANS.length];

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="lm-phase-title"
      data-testid="lm-phase-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#02030a]/95 p-3 text-amber-50 sm:p-6"
    >
      <div className="pointer-events-none fixed inset-0">
        <CrtOverlay />
      </div>
      <div
        className={`${retroPanelClass} lm-fade-up relative my-auto w-full max-w-md space-y-4 p-4 sm:max-w-xl sm:p-6`}
      >
        <div className="space-y-2 text-center">
          <p className={`${retroLabelClass} leading-normal`}>
            Part {phaseIndex + 1} of {def.phases.length}
          </p>
          <RetroHeading
            as="h2"
            id="lm-phase-title"
            className="text-lg leading-normal break-words sm:text-2xl"
          >
            {phase.title}
          </RetroHeading>
        </div>

        <div
          aria-hidden="true"
          data-testid="lm-cutscene-picture"
          className="pointer-events-none relative h-40 overflow-hidden [&_p]:hidden border-4 border-slate-700 bg-[#02030a] sm:h-56"
        >
          <div
            data-testid="lm-cutscene-pan"
            data-moving={isReduced ? "no" : "yes"}
            className={`h-full w-full ${isReduced ? "" : pan}`}
          >
            <Scene run={run} />
          </div>
        </div>

        {frame && (
          <div
            key={index}
            data-testid="lm-cutscene-frame"
            data-frame={index + 1}
            className="lm-fade-up space-y-3 text-left font-mono text-sm text-slate-200 sm:text-base"
          >
            <p>{frame.text}</p>
            {frame.tips && (
              <ul
                data-testid="lm-cutscene-tips"
                className="space-y-2 border-2 border-emerald-300/60 bg-emerald-950/30 p-3 text-emerald-100"
              >
                {frame.tips.map((tip) => (
                  <li key={tip} className="flex gap-2">
                    <span aria-hidden="true" className="text-emerald-300">
                      ◆
                    </span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            )}
            {isLast && phase.goal && (
              <p
                data-testid="lm-phase-goal"
                className="border-2 border-cyan-300/70 bg-cyan-950/40 p-3 font-mono text-sm text-cyan-100"
              >
                <span
                  className={`${pixelClass} mr-2 text-[10px] text-cyan-200`}
                >
                  Your goal:
                </span>
                {phase.goal}
              </p>
            )}
            {isLast && opening}
            <ListenButton
              clipId={cutClipId(def.id, phase.id, index + 1)}
              label="Listen"
              accessibleLabel="Listen to this part"
              className={`${retroSecondaryButtonClass} gap-2`}
            />
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1" aria-hidden="true">
            {frames.map((f, i) => (
              <span
                key={f.text}
                className={`size-2 border border-amber-300 ${
                  i === index ? "bg-amber-300" : "bg-transparent"
                }`}
              />
            ))}
          </div>
          <p className="sr-only" aria-live="polite">
            Step {index + 1} of {frames.length}
          </p>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={() => go(index - 1)}
                className={retroSecondaryButtonClass}
              >
                Back
              </button>
            )}
            {!isLast && (
              <button
                type="button"
                onClick={() => go(last)}
                className={retroSecondaryButtonClass}
              >
                Skip
              </button>
            )}
            <button
              ref={primaryRef}
              type="button"
              onClick={() => (isLast ? onContinue() : go(index + 1))}
              className={`${retroPrimaryButtonClass} min-w-28 !ring-offset-slate-950`}
            >
              <span aria-hidden="true" className="motion-safe:animate-pulse">
                ▶︎
              </span>
              <span className={pixelClass}>
                {isLast ? finishLabel : "Next"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
