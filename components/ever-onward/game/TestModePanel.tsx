"use client";

import { useState } from "react";
import { PLAYABLE_UNIVERSES } from "@/lib/ever-onward/universes";
import { JUMP_POINTS, type JumpPoint } from "@/lib/ever-onward/test/jump";
import { MAP_PRESETS, type MapPreset } from "@/lib/ever-onward/test/mapJump";
import { TEST_SPEEDS, type TestSpeed } from "@/lib/ever-onward/test/tester";
import {
  pixelClass,
  retroFocusClass,
  retroPrimaryButtonClass,
} from "./retro/retroStyles";

interface TestModePanelProps {
  /** The universe open now (picked first). */
  currentId: string;
  speed: TestSpeed | null;
  isJumping: boolean;
  onJump: (universeId: string, phase: number, point: JumpPoint) => void;
  /** Lands on the universe's map with a run just finished. */
  onJumpMap?: (universeId: string, preset: MapPreset) => void;
  onSpeed: (speed: TestSpeed) => void;
  onExit: () => void;
}

const chipClass = (isOn: boolean) =>
  `min-h-11 min-w-11 touch-manipulation border-2 px-2 font-mono text-xs ${retroFocusClass} ${
    isOn
      ? "border-fuchsia-300 bg-fuchsia-900/60 text-fuchsia-50"
      : "border-slate-600 bg-slate-900 text-slate-200 hover:bg-slate-800"
  }`;

/**
 * Test mode (owner only): jump into any part of any universe, played there
 * by the bot, in a run that is never saved. Your real game is untouched.
 */
export default function TestModePanel({
  currentId,
  speed,
  isJumping,
  onJump,
  onJumpMap,
  onSpeed,
  onExit,
}: TestModePanelProps) {
  const [pickedId, setPickedId] = useState(currentId);
  const picked =
    PLAYABLE_UNIVERSES.find((u) => u.id === pickedId) ?? PLAYABLE_UNIVERSES[0];
  return (
    <div
      data-testid="eo-test-mode"
      className="space-y-3 border-2 border-fuchsia-400 bg-fuchsia-950/30 p-3"
    >
      <p className="font-mono text-xs text-fuchsia-100">
        Only you see this. A test run is never saved; your real game stays
        exactly where you left it.
      </p>
      {speed !== null && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`${pixelClass} text-[10px] text-fuchsia-200`}>
              Speed
            </span>
            {TEST_SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={speed === s}
                data-testid={`eo-test-speed-${s}`}
                onClick={() => onSpeed(s)}
                className={chipClass(speed === s)}
              >
                {s}×
              </button>
            ))}
          </div>
          <button
            type="button"
            data-testid="eo-test-exit"
            onClick={onExit}
            className={`${retroPrimaryButtonClass} w-full`}
          >
            Back to my game
          </button>
        </div>
      )}
      <div role="group" aria-label="Universe" className="flex flex-wrap gap-2">
        {PLAYABLE_UNIVERSES.map((u) => (
          <button
            key={u.id}
            type="button"
            aria-pressed={u.id === picked.id}
            onClick={() => setPickedId(u.id)}
            className={chipClass(u.id === picked.id)}
          >
            {u.title}
          </button>
        ))}
      </div>
      <ol className="space-y-2">
        {picked.phases.map((p, index) => (
          <li key={p.id} className="space-y-1">
            <p className="font-mono text-xs text-slate-100">
              {index + 1}. {p.title}
            </p>
            <div className="flex flex-wrap gap-2">
              {JUMP_POINTS.map((point) => (
                <button
                  key={point.id}
                  type="button"
                  disabled={isJumping}
                  data-testid={`eo-jump-${picked.id}-${index}-${point.id}`}
                  onClick={() => onJump(picked.id, index, point.id)}
                  className={`${chipClass(false)} disabled:opacity-40`}
                >
                  {point.label}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ol>
      {picked.map && onJumpMap && (
        <div className="space-y-1">
          <p className="font-mono text-xs text-slate-100">
            {picked.map.title}: a run just finished
          </p>
          <div className="flex flex-wrap gap-2">
            {MAP_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                disabled={isJumping}
                data-testid={`eo-jump-map-${picked.id}-${preset.id}`}
                onClick={() => onJumpMap(picked.id, preset.id)}
                className={`${chipClass(false)} disabled:opacity-40`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {isJumping && (
        <p role="status" className="font-mono text-xs text-fuchsia-100">
          Getting there…
        </p>
      )}
    </div>
  );
}
