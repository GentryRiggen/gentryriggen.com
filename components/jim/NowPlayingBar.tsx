"use client";

import type { PointerEvent, ReactNode } from "react";
import { LoaderCircle, Minus, Pause, Play, Plus, X } from "lucide-react";
import type { PlayerState } from "@/lib/jim/player";
import { formatSpeed, MAX_SPEED, MIN_SPEED, stepSpeed } from "@/lib/jim/speech";

interface NowPlayingBarProps {
  state: PlayerState;
  onTogglePause: () => void;
  onSpeed: (speed: number) => void;
  onStop: () => void;
  /** Clears the error the bar is showing. */
  onDismiss: () => void;
}

/** A tap on the bar mustn't take focus from the box (the keyboard stays up). */
function keepFocus(event: PointerEvent<HTMLButtonElement>) {
  event.preventDefault();
}

interface BarButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}

/** 44px to tap, whatever the icon's size. */
function BarButton({ label, onClick, disabled, children }: BarButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      onPointerDown={keepFocus}
      className="flex size-11 shrink-0 items-center justify-center rounded-full text-ayu-subtle transition-colors! duration-150! hover:text-ayu-text disabled:opacity-40 disabled:hover:text-ayu-subtle"
    >
      {children}
    </button>
  );
}

/**
 * What is being read, just above the composer: play/pause, the start of
 * the reply, how far along, the speed (− 1.25× +) and stop. Shown while
 * anything is loading, playing or paused; an error stays until closed.
 */
export default function NowPlayingBar({
  state,
  onTogglePause,
  onSpeed,
  onStop,
  onDismiss,
}: NowPlayingBarProps) {
  const { status, speed } = state;
  if (status === "idle") return null;

  if (status === "error") {
    return (
      <div
        role="alert"
        className="jim-glass jim-rise mb-2 flex items-center gap-2 rounded-2xl border border-ayu-red/25 pl-3.5 text-sm text-ayu-red"
      >
        <span className="min-w-0 flex-1">{state.error}</span>
        <BarButton label="Close" onClick={onDismiss}>
          <X aria-hidden="true" className="size-4" />
        </BarButton>
      </div>
    );
  }

  const loading = status === "loading";
  const playing = status === "playing";
  const known = state.engine === "audio" && state.parts > 0;
  const progress = known
    ? Math.min(1, (state.part + state.partProgress) / state.parts)
    : 0;

  return (
    <div
      role="region"
      aria-label="Now playing"
      className="jim-glass jim-rise mb-2 flex items-center rounded-2xl border border-white/[0.08] px-0.5 shadow-[0_8px_30px_-16px_rgb(0_0_0/0.8)]"
    >
      <BarButton
        label={loading ? "Loading" : playing ? "Pause" : "Play"}
        onClick={onTogglePause}
        disabled={loading}
      >
        {loading ? (
          <LoaderCircle
            aria-hidden="true"
            className="size-[1.125rem] animate-spin text-ayu-accent motion-reduce:animate-none"
          />
        ) : playing ? (
          <Pause
            aria-hidden="true"
            className="size-[1.125rem] fill-current text-ayu-accent"
          />
        ) : (
          <Play
            aria-hidden="true"
            className="size-[1.125rem] fill-current text-ayu-accent"
          />
        )}
      </BarButton>

      <div className="min-w-0 flex-1 px-1">
        <p className="truncate text-sm text-ayu-text">{state.title}</p>
        <div
          role="progressbar"
          aria-label="Progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={known ? Math.round(progress * 100) : undefined}
          aria-valuetext={
            known ? `Part ${state.part + 1} of ${state.parts}` : undefined
          }
          className="mt-1.5 h-0.5 overflow-hidden rounded-full bg-white/[0.08]"
        >
          <div
            className={`h-full rounded-full bg-ayu-accent transition-[width] duration-300 ease-linear motion-reduce:transition-none ${
              known ? "" : "w-full animate-pulse opacity-50"
            }`}
            style={known ? { width: `${progress * 100}%` } : undefined}
          />
        </div>
      </div>

      <BarButton
        label="Slower"
        onClick={() => onSpeed(stepSpeed(speed, -1))}
        disabled={speed <= MIN_SPEED}
      >
        <Minus aria-hidden="true" className="size-4" />
      </BarButton>
      <span className="w-9 shrink-0 text-center text-xs font-medium text-ayu-text tabular-nums">
        <span className="sr-only">Speed </span>
        {formatSpeed(speed)}
      </span>
      <BarButton
        label="Faster"
        onClick={() => onSpeed(stepSpeed(speed, 1))}
        disabled={speed >= MAX_SPEED}
      >
        <Plus aria-hidden="true" className="size-4" />
      </BarButton>
      <BarButton label="Stop reading" onClick={onStop}>
        <X aria-hidden="true" className="size-4" />
      </BarButton>
    </div>
  );
}
