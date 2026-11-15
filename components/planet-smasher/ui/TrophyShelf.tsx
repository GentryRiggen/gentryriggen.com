"use client";

import { useState } from "react";
import { useGameStore } from "@/lib/planet-smasher/store";
import { TROPHIES, progressToward } from "@/lib/planet-smasher/trophies";
import { playCue } from "../audio/sfx";

/** A 🏆 button under the planet picker; opens every trophy, earned or not. */
export default function TrophyShelf() {
  const progress = useGameStore((s) => s.progress);
  const [open, setOpen] = useState(false);
  const earned = TROPHIES.filter((t) => progress.trophies.includes(t.id));

  return (
    <>
      <button
        type="button"
        aria-label="Trophies"
        aria-expanded={open}
        onClick={() => {
          playCue("uiTap");
          setOpen(true);
        }}
        className="relative mt-2 flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/40 bg-black/55 text-3xl active:scale-95"
      >
        <span aria-hidden="true">🏆</span>
        <span className="absolute -bottom-1 -right-1 rounded-full bg-yellow-300 px-1.5 text-[11px] font-black leading-4 text-black">
          {earned.length}/{TROPHIES.length}
        </span>
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Trophy shelf"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-0 z-50 flex flex-col items-center overflow-y-auto bg-black/85 px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))] text-white"
        >
          <div className="mb-4 flex w-full max-w-3xl items-center justify-between">
            <h2 className="text-2xl font-black text-yellow-300 sm:text-4xl">
              🏆 Trophies {earned.length}/{TROPHIES.length}
            </h2>
            <button
              type="button"
              aria-label="Close trophies"
              onClick={() => setOpen(false)}
              className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-white/40 bg-black/60 text-4xl font-black active:scale-95"
            >
              <span aria-hidden="true">✕</span>
            </button>
          </div>
          <ul className="grid w-full max-w-3xl grid-cols-4 gap-3 sm:grid-cols-5">
            {TROPHIES.map((t) => {
              const have = progress.trophies.includes(t.id);
              const count = have ? null : progressToward(t.id, progress);
              const goal = t.goal;
              return (
                <li
                  key={t.id}
                  data-testid="trophy-tile"
                  aria-label={`${t.name}, ${have ? "earned" : "locked"}`}
                  className={`flex min-h-[4.5rem] min-w-[4.5rem] flex-col items-center justify-start gap-1 rounded-2xl border-2 p-2 text-center ${
                    have
                      ? "border-yellow-300 bg-yellow-300/15 shadow-[0_0_12px_rgba(253,224,71,0.5)]"
                      : "border-white/15 bg-slate-800/70"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`text-4xl sm:text-5xl ${
                      have ? "" : "grayscale brightness-0 opacity-40"
                    }`}
                  >
                    {t.icon}
                  </span>
                  <span
                    className={`text-[11px] font-bold leading-tight sm:text-sm ${
                      have ? "text-yellow-200" : "text-slate-300"
                    }`}
                  >
                    {t.name}
                  </span>
                  {count !== null && goal && (
                    <div
                      role="progressbar"
                      aria-label={`${t.name} progress`}
                      aria-valuemin={0}
                      aria-valuemax={goal}
                      aria-valuenow={Math.min(count, goal)}
                      className="h-1.5 w-full overflow-hidden rounded-full bg-white/15"
                    >
                      <div
                        className="h-full rounded-full bg-yellow-300"
                        style={{
                          width: `${Math.min(100, (count / goal) * 100)}%`,
                        }}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}
