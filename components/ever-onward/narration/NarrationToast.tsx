"use client";

import { focusRingClass } from "../styles";
import type { NarrationApi } from "./useNarration";

type NarrationToastProps = Pick<
  NarrationApi,
  "toast" | "playToast" | "dismissToast"
>;

const buttonClass = `inline-flex min-h-11 touch-manipulation items-center justify-center rounded-lg px-3 text-sm font-semibold ${focusRingClass}`;

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
      className="fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 mx-auto flex w-[min(92vw,26rem)] items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 pl-4 text-slate-900 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">📻 New message</p>
        <p className="truncate text-xs text-slate-600 dark:text-slate-400">
          {toast.preview}
        </p>
      </div>
      <button
        type="button"
        onClick={playToast}
        aria-label="Play new message"
        className={`${buttonClass} bg-amber-400 text-amber-950 hover:bg-amber-300 dark:bg-amber-500 dark:hover:bg-amber-400`}
      >
        ▶ Play
      </button>
      <button
        type="button"
        onClick={dismissToast}
        aria-label="Dismiss new message"
        className={`${buttonClass} text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800`}
      >
        ✕
      </button>
    </div>
  );
}
