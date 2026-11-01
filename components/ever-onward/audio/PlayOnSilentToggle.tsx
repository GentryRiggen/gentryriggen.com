"use client";

import { useId } from "react";
import { playOnSilent, setPlayOnSilent } from "../../game-audio/audioSession";
import { pixelClass } from "../game/retro/retroStyles";

/** Switch for playing the game's sound even when the phone is on silent. */
export default function PlayOnSilentToggle() {
  const isOn = playOnSilent.useValue();
  const id = useId();
  return (
    <div className="space-y-1">
      <p className={`${pixelClass} text-[10px] text-cyan-200`}>Silent mode</p>
      <div className="flex min-h-11 items-center justify-between gap-3">
        <span id={`${id}-label`} className="font-mono text-sm text-slate-200">
          Play sound on silent
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={isOn}
          aria-labelledby={`${id}-label`}
          aria-describedby={`${id}-hint`}
          onClick={() => setPlayOnSilent(!isOn)}
          className={`relative inline-flex h-7 w-12 shrink-0 touch-manipulation items-center border-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 ${
            isOn
              ? "border-amber-300 bg-amber-500"
              : "border-slate-500 bg-slate-800"
          }`}
        >
          <span
            aria-hidden="true"
            className={`inline-block size-4 bg-slate-100 transition-transform ${
              isOn ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
      <p id={`${id}-hint`} className="font-mono text-xs text-slate-300">
        On: sounds play even when your phone is on silent, but they&apos;ll
        pause your podcast or music.
      </p>
    </div>
  );
}
