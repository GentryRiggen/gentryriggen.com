"use client";

import { useEffect, useRef, useState } from "react";
import type { ArtifactDef } from "@/lib/ever-onward/engine/types";
import { everOnwardSynth } from "../../audio/everOnwardSynth";
import Glyph from "./Glyph";
import { pixelClass, retroPrimaryButtonClass } from "../retro/retroStyles";

interface ArtifactRevealProps {
  artifact: ArtifactDef;
  onDone: () => void;
}

const VERDICT: Record<ArtifactDef["tier"], string> = {
  big: "A great find!",
  modest: "A good find.",
  odd: "A strange find…",
};

/** The glyph rises and flips, then its name types on. */
const TYPE_DELAY_MS = 1500;
const TYPE_STEP_MS = 45;

/**
 * The finding moment: the screen dims, the strange glyph rises out of the
 * chart, flips over, and its name types on. Big finds burst with light.
 */
export default function ArtifactReveal({
  artifact,
  onDone,
}: ArtifactRevealProps) {
  const [typed, setTyped] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const isTyped = typed >= artifact.name.length;

  useEffect(() => {
    everOnwardSynth.cue(artifact.tier === "big" ? "phase" : "reveal");
    let timer = 0;
    const start = window.setTimeout(() => {
      timer = window.setInterval(() => {
        setTyped((n) => {
          if (n + 1 >= artifact.name.length) window.clearInterval(timer);
          return n + 1;
        });
      }, TYPE_STEP_MS);
    }, TYPE_DELAY_MS);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(timer);
    };
  }, [artifact]);

  useEffect(() => {
    if (isTyped) buttonRef.current?.focus();
  }, [isTyped]);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="eo-reveal-name"
      data-testid="eo-map-reveal"
      data-tier={artifact.tier}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 overflow-hidden bg-[#02030a]/95 px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-center"
    >
      <p className={`${pixelClass} lm-fade-up text-[10px] text-cyan-200`}>
        You found something
      </p>
      <div className="relative flex h-44 w-44 items-center justify-center">
        {artifact.tier === "big" && (
          <span
            aria-hidden="true"
            className="eo-map-burst absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(255,226,122,0.85)_0%,rgba(255,159,58,0.35)_35%,transparent_70%)]"
          />
        )}
        <span
          aria-hidden="true"
          className="eo-map-rays absolute inset-[-40%] bg-[repeating-conic-gradient(rgba(186,230,253,0.16)_0deg_8deg,transparent_8deg_24deg)]"
        />
        <div className="eo-map-rise relative h-32 w-32">
          <Glyph
            glyph={artifact.glyph}
            palette={artifact.palette}
            className="h-full w-full drop-shadow-[0_0_12px_rgba(255,236,170,0.8)]"
          />
        </div>
      </div>
      <h2
        id="eo-reveal-name"
        aria-label={artifact.name}
        className={`${pixelClass} min-h-6 text-sm leading-relaxed text-amber-200 sm:text-base`}
      >
        <span aria-hidden="true">{artifact.name.slice(0, typed)}</span>
        {!isTyped && (
          <span aria-hidden="true" className="eo-map-caret">
            _
          </span>
        )}
      </h2>
      <div
        className={`max-w-sm space-y-2 transition-opacity duration-500 ${
          isTyped ? "opacity-100" : "opacity-0"
        }`}
      >
        <p className={`${pixelClass} text-[10px] text-cyan-200`}>
          {VERDICT[artifact.tier]}
        </p>
        <p className="font-mono text-sm text-slate-100">{artifact.effect}</p>
        {artifact.catch && (
          <p className="font-mono text-sm text-rose-300">
            Catch: {artifact.catch} You can switch it off on the shelf.
          </p>
        )}
      </div>
      <button
        ref={buttonRef}
        type="button"
        data-testid="eo-map-reveal-continue"
        // Before the name is out, a tap skips to the end of the reveal.
        onClick={isTyped ? onDone : () => setTyped(artifact.name.length)}
        className={`${retroPrimaryButtonClass} min-w-40 transition-opacity ${
          isTyped ? "opacity-100" : "opacity-40"
        }`}
      >
        Continue
      </button>
    </div>
  );
}
