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
import type {
  CutsceneFrame,
  UniverseDef,
} from "@/lib/ever-onward/engine/types";
import { cutClipId, cutEndClipId } from "@/lib/ever-onward/narration/lines";
import { getClip } from "@/lib/ever-onward/narration/manifest";
import {
  playNarration,
  stopNarration,
  useNarrationPlaying,
} from "../narration/player";
import {
  setNarrationSettings,
  useNarrationSettings,
} from "../narration/settings";
import type { SceneProps } from "../universes/types";
import FilmRobot from "./film/FilmRobot";
import FilmStars from "./film/FilmStars";
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
  /** Called by the closing card's button. */
  onContinue: () => void;
  /** What the closing card's button says (Start for a new part, Done to re-watch). */
  finishLabel?: string;
  /** The opening of a new run may ask a question (see `UniverseUi.Opening`). */
  opening?: ReactNode;
}

const FOCUSABLE =
  'button:not([disabled]):not([tabindex="-1"]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** How often the film's clock ticks. */
export const FILM_TICK_MS = 50;
/** Milliseconds per typed letter. */
const TYPE_MS = 30;
/** Time to read a line after it has finished typing. */
const READ_MS = 2600;
/** Time after the voice ends before the next shot. */
const AFTER_VOICE_MS = 900;
/** A voice that has not started by now is not coming (blocked or slow). */
const VOICE_GRACE_MS = 2500;

/** The least time a shot stays on screen. */
export function shotMs(frame: CutsceneFrame): number {
  const typed = frame.text.length * TYPE_MS + READ_MS;
  const set = (frame.seconds ?? 0) * 1000;
  return Math.max(5000, typed, set);
}

/**
 * The intro film that plays when a part begins. It plays by itself: each
 * shot fades up, the camera moves over the part's own scene, the little
 * robot acts in front of it, and the line types out and is read aloud. Then
 * a closing card shows the goal, the tips and the Start button. Skip jumps
 * to that card; tapping the picture hurries the film along.
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
  const frames = useMemo<readonly CutsceneFrame[]>(
    () =>
      phase.cutscene?.length
        ? phase.cutscene
        : [{ text: phase.intro ?? phase.title }],
    [phase]
  );
  /** Shots are 0..frames.length - 1; frames.length is the closing card. */
  const endIndex = frames.length;
  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const isReduced = useReducedMotion();
  const { isEnabled: isVoiceOn } = useNarrationSettings();
  const nowPlaying = useNarrationPlaying();
  const rootRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);

  const isEnd = index >= endIndex;
  const frame = isEnd ? undefined : frames[index];
  const clipId = isEnd
    ? cutEndClipId(def.id, phase.id)
    : cutClipId(def.id, phase.id, index + 1);
  const hasVoice = isVoiceOn && Boolean(getClip(clipId));
  const hasAnyVoice = Boolean(getClip(cutClipId(def.id, phase.id, 1)));

  const showcase = showcaseAt(frames, Math.min(index, endIndex - 1));
  const run = useMemo(
    () => showcaseRun(def, phaseIndex, showcase),
    [def, phaseIndex, showcase]
  );

  /** Whether this shot's voice has started, and when (film ms) it ended. */
  const voiceRef = useRef<{ started: boolean; endedAt: number | null }>({
    started: false,
    endedAt: null,
  });
  const elapsedRef = useRef(elapsed);

  const go = (to: number) => {
    stopNarration();
    voiceRef.current = { started: false, endedAt: null };
    setElapsed(0);
    setIndex(Math.min(endIndex, Math.max(0, to)));
  };
  const goRef = useRef(go);
  const onContinueRef = useRef(onContinue);
  const stateRef = useRef({ index, finishLabel, isEnd, elapsed, frame });
  useEffect(() => {
    goRef.current = go;
    onContinueRef.current = onContinue;
    elapsedRef.current = elapsed;
    stateRef.current = { index, finishLabel, isEnd, elapsed, frame };
  });

  // Each shot (and the closing card) reads its own line.
  useEffect(() => {
    if (!hasVoice || isPaused || voiceRef.current.started) return;
    playNarration(clipId);
  }, [clipId, hasVoice, isPaused]);

  // Notice when the voice starts and stops.
  useEffect(() => {
    const voice = voiceRef.current;
    if (nowPlaying === clipId) voice.started = true;
    else if (voice.started && voice.endedAt === null) {
      voice.endedAt = elapsedRef.current;
    }
  }, [nowPlaying, clipId]);

  // The film's clock.
  useEffect(() => {
    if (isPaused || isEnd) return;
    const timer = window.setInterval(
      () => setElapsed((ms) => ms + FILM_TICK_MS),
      FILM_TICK_MS
    );
    return () => window.clearInterval(timer);
  }, [isPaused, isEnd, index]);

  // Move on when the shot has had its time and the voice has finished.
  useEffect(() => {
    if (isEnd || isPaused || !frame) return;
    const least = shotMs(frame);
    if (elapsed < least) return;
    if (hasVoice) {
      const voice = voiceRef.current;
      const guess = (getClip(clipId)?.durationGuess ?? 0) * 1000;
      // Never hang on a voice that went quiet without telling us.
      const cap = Math.max(least, guess) + 6000;
      if (elapsed < cap) {
        if (!voice.started && elapsed < least + VOICE_GRACE_MS) return;
        if (voice.started && voice.endedAt === null) return;
        if (voice.endedAt !== null && elapsed < voice.endedAt + AFTER_VOICE_MS)
          return;
      }
    }
    goRef.current(index + 1);
  }, [elapsed, isEnd, isPaused, frame, hasVoice, clipId, index]);

  // Focus the film on open; give focus back when it closes.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    rootRef.current?.focus();
    return () => {
      stopNarration();
      before?.focus?.();
    };
  }, []);

  // The closing card's button takes focus.
  useEffect(() => {
    if (isEnd) primaryRef.current?.focus();
  }, [isEnd]);

  /** Tapping the picture finishes the typing, then moves on. */
  const hurry = () => {
    const { frame: now, elapsed: ms, index: at } = stateRef.current;
    if (!now) return;
    const typedMs = now.text.length * TYPE_MS;
    if (ms < typedMs) setElapsed(typedMs);
    else goRef.current(at + 1);
  };
  const hurryRef = useRef(hurry);
  useEffect(() => {
    hurryRef.current = hurry;
  });

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const { index: now, finishLabel: label, isEnd: atEnd } = stateRef.current;
      const target = event.target as HTMLElement | null;
      if (
        (event.key === "ArrowRight" || event.key === "ArrowLeft") &&
        target?.closest?.('[role="radiogroup"],input,select,textarea')
      ) {
        // Arrows belong to the lantern picker and form fields.
        return;
      }
      if (event.key === "Escape" && label === "Done") {
        event.preventDefault();
        onContinueRef.current();
      } else if (event.key === "ArrowRight" && !atEnd) {
        event.preventDefault();
        goRef.current(now + 1);
      } else if (event.key === "ArrowLeft" && now > 0) {
        event.preventDefault();
        goRef.current(now - 1);
      } else if (event.key === "Enter") {
        // A focused button already activates itself on Enter.
        if (target?.closest("button")) return;
        event.preventDefault();
        if (!atEnd) hurryRef.current();
        else onContinueRef.current();
      } else if (event.key === "Tab") {
        const nodes = rootRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
        if (!nodes || nodes.length === 0) return;
        const first = nodes[0];
        const end = nodes[nodes.length - 1];
        const active = document.activeElement;
        if (!rootRef.current?.contains(active) || active === rootRef.current) {
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
  }, []);

  const togglePause = () => {
    if (isPaused) {
      setIsPaused(false);
    } else {
      stopNarration();
      // Do not wait for a voice that was stopped.
      voiceRef.current = { started: true, endedAt: elapsed };
      setIsPaused(true);
    }
  };

  const typed = frame
    ? isReduced
      ? frame.text
      : frame.text.slice(0, Math.floor(elapsed / TYPE_MS))
    : "";
  const isTyping = Boolean(frame) && typed.length < (frame?.text.length ?? 0);
  const card = frame?.card;
  const camera = frame?.camera ?? "drift";
  const lastRobot = frames[endIndex - 1]?.robot;
  const robot = isEnd
    ? {
        move: "idle" as const,
        x: lastRobot?.move === "exit" ? 22 : (lastRobot?.x ?? 22),
        facing: lastRobot?.facing,
      }
    : frame?.robot;

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="lm-phase-title"
      data-testid="lm-phase-overlay"
      data-film-shot={isEnd ? "end" : index + 1}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-[#02030a] text-amber-50 outline-none"
    >
      <div className="pointer-events-none fixed inset-0">
        <CrtOverlay />
      </div>

      {/* The top strip: where you are, and the film's controls. */}
      <div className="relative flex shrink-0 items-center justify-between gap-2 px-3 pt-3 sm:px-6 sm:pt-4">
        <div className="min-w-0">
          <p className={`${retroLabelClass} leading-normal`}>
            Part {phaseIndex + 1} of {def.phases.length}
          </p>
          <RetroHeading
            as="h2"
            id="lm-phase-title"
            className="text-sm leading-normal break-words sm:text-lg"
          >
            {phase.title}
          </RetroHeading>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {hasAnyVoice && (
            <button
              type="button"
              aria-pressed={isVoiceOn}
              onClick={() => {
                if (isVoiceOn) stopNarration();
                setNarrationSettings({ isEnabled: !isVoiceOn });
              }}
              className={retroSecondaryButtonClass}
            >
              <span aria-hidden="true">{isVoiceOn ? "♪" : "×"}</span>
              <span className={`${pixelClass} sr-only sm:not-sr-only`}>
                Voice
              </span>
            </button>
          )}
          {!isEnd && (
            <button
              type="button"
              aria-pressed={isPaused}
              onClick={togglePause}
              className={retroSecondaryButtonClass}
            >
              <span className={pixelClass}>{isPaused ? "Play" : "Pause"}</span>
            </button>
          )}
          {!isEnd && (
            <button
              type="button"
              onClick={() => go(endIndex)}
              className={retroSecondaryButtonClass}
            >
              <span className={pixelClass}>Skip</span>
            </button>
          )}
        </div>
      </div>

      <div className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-3 px-3 py-3 sm:gap-4 sm:px-6">
        {/*
          The picture: letterboxed, 4:3 like every scene. The scene's own
          little robot steps aside so the film's robot is the only one.
        */}
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          disabled={isEnd}
          onClick={hurry}
          data-testid="lm-cutscene-picture"
          className={`relative mx-auto block aspect-[4/3] w-full cursor-pointer overflow-hidden border-4 border-slate-800 bg-[#02030a] [&_p]:hidden [&_.eo-scene-robot]:hidden disabled:cursor-default ${
            isEnd
              ? "max-w-[min(100%,calc(30svh*4/3))]"
              : "max-w-[min(100%,calc(58svh*4/3))]"
          }`}
        >
          <div
            key={`${index}-${card ?? "scene"}`}
            className={`absolute inset-0 ${isReduced ? "" : "eo-film-cut"}`}
          >
            {card === "title" ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 text-center">
                <FilmStars />
                {/* Spans: the picture hides every <p> (the scenes' captions). */}
                <span
                  className={`${pixelClass} relative block text-[10px] text-amber-200/80 sm:text-xs`}
                >
                  Ever Onward
                </span>
                <span
                  data-testid="eo-film-title"
                  className={`${pixelClass} eo-film-title relative block text-xl leading-snug text-amber-100 sm:text-3xl`}
                >
                  {def.title}
                </span>
              </div>
            ) : card === "dark" ? (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_80%,#1e1b4b_0%,#02030a_65%)]" />
            ) : (
              <div
                data-testid="lm-cutscene-pan"
                data-camera={isReduced ? "still" : camera}
                className={`h-full w-full ${
                  isReduced || isEnd ? "" : `eo-cam eo-cam-${camera}`
                }`}
              >
                <Scene run={run} testId="lm-cutscene-scene" />
              </div>
            )}
          </div>
          {robot && (
            <FilmRobot robot={robot} shotKey={isEnd ? "end" : String(index)} />
          )}
          {/* Letterbox bars. */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[6%] bg-black/70" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[3%] bg-black/70" />
          {isPaused && !isEnd && (
            <span
              className={`${pixelClass} absolute top-3 left-3 bg-black/70 px-2 py-1 text-[10px] text-amber-200`}
            >
              Paused
            </span>
          )}
        </button>

        {frame && (
          <div
            data-testid="lm-cutscene-frame"
            data-frame={index + 1}
            className="mx-auto w-full max-w-2xl"
          >
            <p className="sr-only" aria-live="polite">
              {frame.text}
            </p>
            <p
              aria-hidden="true"
              data-testid="eo-film-caption"
              className="min-h-[5.5rem] font-mono text-base leading-relaxed text-amber-50 sm:min-h-[6.5rem] sm:text-xl"
            >
              {typed}
              <span
                className={`ml-0.5 inline-block w-2 text-amber-300 ${
                  isTyping ? "" : "motion-safe:animate-pulse"
                }`}
              >
                ▌
              </span>
            </p>
          </div>
        )}

        {isEnd && (
          <div
            data-testid="lm-cutscene-end"
            className={`${retroPanelClass} lm-fade-up mx-auto w-full max-w-xl space-y-3 p-4 sm:p-5`}
          >
            {phase.goal && (
              <p
                data-testid="lm-phase-goal"
                className="border-2 border-cyan-300/70 bg-cyan-950/40 p-3 font-mono text-sm text-cyan-100 sm:text-base"
              >
                <span
                  className={`${pixelClass} mr-2 text-[10px] text-cyan-200`}
                >
                  Your goal:
                </span>
                {phase.goal}
              </p>
            )}
            {phase.tips && phase.tips.length > 0 && (
              <ul
                data-testid="lm-cutscene-tips"
                className="space-y-2 border-2 border-emerald-300/60 bg-emerald-950/30 p-3 font-mono text-sm text-emerald-100"
              >
                {phase.tips.map((tip) => (
                  <li key={tip} className="flex gap-2">
                    <span aria-hidden="true" className="text-emerald-300">
                      ◆
                    </span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            )}
            {opening}
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => go(0)}
                className={retroSecondaryButtonClass}
              >
                <span className={pixelClass}>Watch again</span>
              </button>
              <button
                ref={primaryRef}
                type="button"
                onClick={onContinue}
                className={`${retroPrimaryButtonClass} min-w-28 !ring-offset-slate-950`}
              >
                <span aria-hidden="true" className="motion-safe:animate-pulse">
                  ▶︎
                </span>
                <span className={pixelClass}>{finishLabel}</span>
              </button>
            </div>
          </div>
        )}

        {/* The film's progress. */}
        <div className="mx-auto flex w-full max-w-2xl gap-1" aria-hidden="true">
          {[...frames, null].map((_, i) => (
            <span
              key={i}
              className={`h-1 flex-1 ${
                i < index
                  ? "bg-amber-300/80"
                  : i === index
                    ? "bg-amber-300"
                    : "bg-slate-700"
              }`}
            />
          ))}
        </div>
        <p className="sr-only" aria-live="polite">
          {isEnd ? "Your goal" : `Scene ${index + 1} of ${frames.length}`}
        </p>
      </div>
    </div>
  );
}
