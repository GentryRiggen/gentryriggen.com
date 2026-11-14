"use client";

import { useEffect, useRef, useState } from "react";
import { cooldownLeft, subscribeCooldown } from "@/lib/planet-smasher/cooldown";
import { useGameStore } from "@/lib/planet-smasher/store";
import { TOOLS, TOOL_ORDER, type ToolId } from "@/lib/planet-smasher/tools";
import {
  UNLOCK_PATH,
  isUnlocked,
  type Unlockable,
} from "@/lib/planet-smasher/unlocks";
import { playCue } from "../audio/sfx";
import { clearFresh, freshKey, useFreshItems } from "./freshItems";
import { formatInt } from "./format";

const costOf = (id: ToolId): number | null =>
  UNLOCK_PATH.find((e) => e.item.kind === "tool" && e.item.id === id)?.at ??
  null;

/** The weapons tray along the bottom edge. */
export default function Arsenal() {
  const points = useGameStore((s) => s.progress.points);
  const selected = useGameStore((s) => s.progress.toolId);
  const fresh = useFreshItems();
  const [shaking, setShaking] = useState<ToolId | null>(null);
  const tiles = useRef<Partial<Record<ToolId, HTMLButtonElement | null>>>({});

  // The cooldown sweep: only runs while something is cooling down, and
  // writes straight to the tile (no React renders).
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      let busy = false;
      for (const id of TOOL_ORDER) {
        const left = cooldownLeft(id);
        tiles.current[id]?.style.setProperty("--ps-sweep", `${left * 360}deg`);
        if (left > 0) busy = true;
      }
      raf = busy ? requestAnimationFrame(tick) : 0;
    };
    const start = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const off = subscribeCooldown(start);
    return () => {
      off();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    if (!shaking) return;
    const t = setTimeout(() => setShaking(null), 450);
    return () => clearTimeout(t);
  }, [shaking]);

  const tap = (id: ToolId, locked: boolean) => {
    if (locked) {
      setShaking(id);
      return;
    }
    const item: Unlockable = { kind: "tool", id };
    clearFresh(item);
    useGameStore.getState().selectTool(id);
    playCue("uiTap");
  };

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 flex snap-x touch-pan-x gap-2 overflow-x-auto bg-gradient-to-t from-black/70 to-transparent px-[max(1rem,env(safe-area-inset-left))] pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-6">
      {TOOL_ORDER.map((id) => {
        const tool = TOOLS[id];
        const locked = !isUnlocked({ kind: "tool", id }, points);
        const isSelected = id === selected && !locked;
        const isFresh = fresh.has(freshKey({ kind: "tool", id }));
        const cost = costOf(id);
        return (
          <button
            key={id}
            type="button"
            ref={(el) => {
              tiles.current[id] = el;
            }}
            aria-label={tool.name}
            aria-disabled={locked || undefined}
            aria-pressed={isSelected}
            onClick={() => tap(id, locked)}
            className={`relative flex h-[72px] min-w-[72px] shrink-0 snap-center flex-col items-center justify-center overflow-hidden rounded-2xl border-2 text-4xl transition-transform ${
              isSelected
                ? "scale-110 border-yellow-300 bg-slate-700 ring-4 ring-yellow-300"
                : "border-white/25 bg-slate-800/90"
            } ${locked ? "opacity-60" : ""} ${
              isFresh ? "animate-pulse ring-4 ring-pink-400" : ""
            } ${shaking === id ? "animate-[ps-shake_0.4s_ease-in-out]" : ""}`}
          >
            <span aria-hidden="true" className={locked ? "grayscale" : ""}>
              {tool.icon}
            </span>
            {locked && cost !== null && (
              <span className="absolute inset-x-0 bottom-0.5 text-center text-[11px] font-bold leading-none text-yellow-200">
                ⭐ {formatInt(cost)}
              </span>
            )}
            {locked && (
              <span
                aria-hidden="true"
                className="absolute right-1 top-1 text-base leading-none"
              >
                🔒
              </span>
            )}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-2xl bg-[conic-gradient(rgb(0_0_0/0.6)_var(--ps-sweep,0deg),transparent_0)]"
            />
          </button>
        );
      })}
    </div>
  );
}
