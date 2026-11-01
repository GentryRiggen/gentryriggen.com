"use client";

import {
  pixelClass,
  retroFocusClass,
  retroPanelClass,
} from "../game/retro/retroStyles";
import type { NarrationApi } from "./useNarration";

type NarrationToastProps = Pick<
  NarrationApi,
  "toast" | "playToast" | "dismissToast"
>;

const buttonClass = `${pixelClass} inline-flex min-h-11 touch-manipulation items-center justify-center border-2 px-3 text-[10px] active:translate-y-0.5 ${retroFocusClass}`;

/** "New message" nudge near the bottom of the screen; the story keeps the text. */
export default function NarrationToast({
  toast,
  playToast,
  dismissToast,
}: NarrationToastProps) {
  if (!toast) return null;
  return (
    <div
      role="status"
      data-testid="lm-narration-toast"
      className={`${retroPanelClass} fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 mx-auto flex w-[min(92vw,26rem)] items-center gap-2 p-2 pl-4 text-slate-100`}
    >
      <div className="min-w-0 flex-1">
        <p className={`${pixelClass} text-[10px] text-amber-300`}>
          📻 New message
        </p>
        <p className="mt-1 truncate font-mono text-xs text-slate-300">
          {toast.preview}
        </p>
      </div>
      <button
        type="button"
        onClick={playToast}
        aria-label="Play new message"
        className={`${buttonClass} border-amber-300 bg-amber-950/60 text-amber-300 hover:bg-amber-900/70`}
      >
        ▶ Play
      </button>
      <button
        type="button"
        onClick={dismissToast}
        aria-label="Dismiss new message"
        className={`${buttonClass} border-slate-600 text-slate-200 hover:bg-slate-800`}
      >
        ✕
      </button>
    </div>
  );
}
