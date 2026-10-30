"use client";

import { Camera } from "lucide-react";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import usePhotoStore from "../hooks/usePhotoStore";

/** Where focus goes back to when photo mode ends. */
export const PHOTO_BUTTON_ID = "photo-button";

/**
 * Opens photo mode. It sits in the view controls (under the sea and time
 * chips), where nothing else competes for room, and only shows while the
 * builder is idle: a trial, a drive or a walk has its own camera.
 */
export default function PhotoButton() {
  const enter = usePhotoStore((s) => s.enter);
  const isIdle = useShipBuilderStore(
    (s) =>
      s.trial.status === "idle" &&
      s.drive.status === "idle" &&
      s.walk.status === "idle"
  );
  if (!isIdle) return null;

  return (
    <div className="pointer-events-auto rounded-lg border border-slate-300 bg-white/90 p-0.5 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/90">
      <button
        id={PHOTO_BUTTON_ID}
        type="button"
        aria-label="Photo"
        title="Photo mode"
        onClick={enter}
        className="inline-flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-md text-violet-700 hover:bg-slate-100 dark:text-violet-300 dark:hover:bg-slate-800"
      >
        <Camera aria-hidden="true" className="h-5 w-5 shrink-0" />
      </button>
    </div>
  );
}
