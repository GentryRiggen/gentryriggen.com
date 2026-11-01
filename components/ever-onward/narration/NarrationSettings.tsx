"use client";

import { useId } from "react";
import { pixelClass } from "../game/retro/retroStyles";
import { setNarrationSettings, useNarrationSettings } from "./settings";

/** Narration on/off and auto-play, remembered on this device. */
export default function NarrationSettings() {
  const { isEnabled, isAutoPlay } = useNarrationSettings();
  const id = useId();
  return (
    <fieldset className="space-y-2">
      <legend className={`${pixelClass} mb-1 text-[10px] text-cyan-200`}>
        Narration
      </legend>
      <label
        htmlFor={`${id}-on`}
        className="flex min-h-11 items-center gap-3 font-mono text-sm text-slate-200"
      >
        <input
          id={`${id}-on`}
          type="checkbox"
          checked={isEnabled}
          onChange={(e) =>
            setNarrationSettings({ isEnabled: e.target.checked })
          }
          className="size-5 accent-amber-500"
        />
        Narration
      </label>
      <label
        htmlFor={`${id}-auto`}
        className="flex min-h-11 items-center gap-3 font-mono text-sm text-slate-200"
      >
        <input
          id={`${id}-auto`}
          type="checkbox"
          checked={isAutoPlay}
          disabled={!isEnabled}
          onChange={(e) =>
            setNarrationSettings({ isAutoPlay: e.target.checked })
          }
          className="size-5 accent-amber-500"
        />
        Read new messages automatically
      </label>
    </fieldset>
  );
}
