"use client";

import { useEffect, useRef, useState } from "react";
import { cooldownLeft, subscribeCooldown } from "@/lib/planet-smasher/cooldown";
import { useGameStore } from "@/lib/planet-smasher/store";
import {
  CATEGORIES,
  TOOLS,
  TOOL_ORDER,
  type ToolCategory,
  type ToolId,
} from "@/lib/planet-smasher/tools";
import {
  UNLOCK_PATH,
  isUnlocked,
  type Unlockable,
} from "@/lib/planet-smasher/unlocks";
import { playCue } from "../audio/sfx";
import { clearFresh, freshKey, useFreshItems } from "./freshItems";
import { formatStars } from "./format";
import { useShownUnlock } from "./shownUnlock";

const costOf = (id: ToolId): number | null =>
  UNLOCK_PATH.find((e) => e.item.kind === "tool" && e.item.id === id)?.at ??
  null;
const COST = Object.fromEntries(
  TOOL_ORDER.map((id) => [id, costOf(id)])
) as Record<ToolId, number | null>;

/** The weapons tray along the bottom edge: four tabs, one row of tiles. */
export default function Arsenal() {
  const points = useGameStore((s) => s.progress.points);
  const shownUnlock = useShownUnlock();
  const owned = useGameStore((s) => s.progress.owned);
  const selected = useGameStore((s) => s.progress.toolId);
  const fresh = useFreshItems();
  const [shaking, setShaking] = useState<ToolId | null>(null);
  const [tab, setTab] = useState<ToolCategory>(TOOLS[selected].category);
  // The tab follows the selected tool (a restore, the test hook) and an
  // unlock toast's tool (the one it is showing). Adjusted during render, not in an effect.
  const [seenTool, setSeenTool] = useState(selected);
  const shownKey = shownUnlock ? `${shownUnlock.kind}:${shownUnlock.id}` : "";
  const [seenShown, setSeenShown] = useState(shownKey);
  if (seenTool !== selected) {
    setSeenTool(selected);
    setTab(TOOLS[selected].category);
  }
  // Once per shown item, so a tab the child taps afterwards stays put.
  if (seenShown !== shownKey) {
    setSeenShown(shownKey);
    if (shownUnlock && shownUnlock.kind === "tool")
      setTab(TOOLS[shownUnlock.id].category);
  }
  const category = CATEGORIES.find((c) => c.id === tab) ?? CATEGORIES[0];
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

  // Locked tiles show how close the stars are as a conic ring.
  useEffect(() => {
    for (const id of category.tools) {
      const at = COST[id];
      const frac = at ? Math.min(1, Math.max(0, points / at)) : 1;
      tiles.current[id]?.style.setProperty("--ps-prog", `${frac * 360}deg`);
    }
  }, [category, points]);

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
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 bg-gradient-to-t from-black/70 to-transparent px-[max(1rem,env(safe-area-inset-left))] pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-6">
      <div role="tablist" aria-label="Weapon types" className="flex gap-3">
        {CATEGORIES.map((c) => {
          const active = c.id === tab;
          const hasFresh = c.tools.some((id) =>
            fresh.has(freshKey({ kind: "tool", id }))
          );
          return (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-label={c.name}
              aria-selected={active}
              onClick={() => {
                setTab(c.id);
                playCue("uiTap");
              }}
              className={`relative flex size-14 items-center justify-center rounded-full border-2 text-3xl transition-transform ${
                active
                  ? "scale-110 border-yellow-300 bg-slate-700 ring-4 ring-yellow-300"
                  : "border-white/25 bg-slate-800/90"
              }`}
            >
              <span aria-hidden="true">{c.icon}</span>
              {hasFresh && (
                <span
                  aria-hidden="true"
                  data-testid={`tab-dot-${c.id}`}
                  className="absolute -right-0.5 -top-0.5 size-4 animate-pulse rounded-full border-2 border-white bg-pink-500"
                />
              )}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" className="flex gap-2">
        {category.tools.map((id) => {
          const tool = TOOLS[id];
          const locked = !isUnlocked({ kind: "tool", id }, points, owned);
          const isSelected = id === selected && !locked;
          const isFresh = fresh.has(freshKey({ kind: "tool", id }));
          const cost = COST[id];
          return (
            <button
              key={id}
              type="button"
              data-testid="arsenal-tile"
              ref={(el) => {
                tiles.current[id] = el;
              }}
              aria-label={tool.name}
              aria-disabled={locked || undefined}
              aria-pressed={isSelected}
              onClick={() => tap(id, locked)}
              className={`relative flex size-16 shrink-0 flex-col sm:size-[72px] items-center justify-center overflow-hidden rounded-2xl border-2 text-4xl transition-transform ${
                isSelected
                  ? "scale-110 border-yellow-300 bg-slate-700 ring-4 ring-yellow-300"
                  : "border-white/25 bg-slate-800/90"
              } ${locked ? "opacity-60" : ""} ${
                isFresh ? "animate-pulse ring-4 ring-pink-400" : ""
              } ${shaking === id ? "animate-[ps-shake_0.4s_ease-in-out]" : ""}`}
            >
              {id === "nukeTwin" ? (
                <span
                  aria-hidden="true"
                  className={`relative flex items-center justify-center ${
                    locked ? "grayscale" : ""
                  }`}
                >
                  <span className="-translate-x-2 -translate-y-1 scale-[0.8]">
                    {tool.icon}
                  </span>
                  <span className="absolute translate-x-2 translate-y-1 scale-[0.8]">
                    {tool.icon}
                  </span>
                </span>
              ) : (
                <span aria-hidden="true" className={locked ? "grayscale" : ""}>
                  {tool.icon}
                </span>
              )}
              {locked && cost !== null && (
                <span className="absolute inset-x-0 bottom-0.5 text-center text-[11px] font-bold leading-none text-yellow-200">
                  ⭐ {formatStars(cost)}
                </span>
              )}
              {locked && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-2xl bg-[conic-gradient(rgb(253_224_71)_var(--ps-prog,0deg),rgb(255_255_255/0.35)_0)] p-[3px] [-webkit-mask-composite:xor] [mask-composite:exclude] [mask:linear-gradient(#000_0_0)_content-box,linear-gradient(#000_0_0)]"
                />
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
    </div>
  );
}
