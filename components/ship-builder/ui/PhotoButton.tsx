"use client";

import { Camera } from "lucide-react";
import usePhotoStore from "../hooks/usePhotoStore";

/** Opens photo mode. Sits beside the Sea trial button, which only shows while
 * no tool or selection is active, so the ship is already clean. */
export default function PhotoButton() {
  const enter = usePhotoStore((s) => s.enter);

  return (
    <button
      type="button"
      aria-label="Photo"
      title="Photo mode"
      onClick={enter}
      className="pointer-events-auto inline-flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-full bg-violet-600 text-sm font-semibold text-white shadow-lg hover:bg-violet-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 dark:bg-violet-500 dark:text-slate-900 dark:hover:bg-violet-400 dark:focus-visible:outline-violet-300"
    >
      <Camera aria-hidden="true" className="h-5 w-5 shrink-0" />
    </button>
  );
}
