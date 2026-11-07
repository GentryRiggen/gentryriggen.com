"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  artifactAt,
  lastSquare,
  legalTargets,
  mapOf,
  parseSquare,
  pendingFind,
  squareChanges,
} from "@/lib/ever-onward/engine/map";
import type {
  SquareKey,
  UniverseDef,
  UniverseSave,
} from "@/lib/ever-onward/engine/types";
import ArtifactReveal from "./ArtifactReveal";
import ArtifactShelf from "./ArtifactShelf";
import Glyph from "./Glyph";
import MapGrid from "./MapGrid";
import RetroHeading from "../retro/RetroHeading";
import {
  pixelClass,
  pixelFont,
  retroFocusClass,
  retroPrimaryButtonClass,
} from "../retro/retroStyles";

export type MapMode = "view" | "choose";

interface MapDialogProps {
  def: UniverseDef;
  universe: UniverseSave;
  /** "choose" once a run is finished: pick where the next run is played. */
  mode: MapMode;
  onStep: (key: SquareKey) => void;
  onToggle: (id: string) => void;
  onClose: () => void;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The prestige map, full screen: the chart, what the picked square changes,
 * and the shelf of finds. After a finished run it first plays the reveal
 * (if the square held something), then asks where to go next.
 */
export default function MapDialog({
  def,
  universe,
  mode,
  onStep,
  onToggle,
  onClose,
}: MapDialogProps) {
  const map = def.map!;
  const state = mapOf(def, universe);
  const isChoosing = mode === "choose" && universe.run.complete;
  const find = isChoosing ? pendingFind(def, universe) : undefined;
  const [isRevealDone, setIsRevealDone] = useState(false);
  const targets = isChoosing ? legalTargets(def, universe) : [];
  // After a reveal the square counts as found and visited on the chart.
  const shown =
    isChoosing && find && isRevealDone
      ? {
          ...state,
          found: [...state.found, find.id],
          visited: state.visited.includes(state.at)
            ? state.visited
            : [...state.visited, state.at],
        }
      : state;
  const [selected, setSelected] = useState<SquareKey>(
    () => (isChoosing ? legalTargets(def, universe)[0] : undefined) ?? state.at
  );
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  const isRevealing = !!find && !isRevealDone;

  useEffect(() => {
    if (!isRevealing) closeRef.current?.focus();
  }, [isRevealing]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const nodes = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!nodes || nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (!panelRef.current?.contains(active)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  const square = parseSquare(selected) ?? { x: 0, y: 0 };
  const artifact = artifactAt(def, selected);
  const isFound = !!artifact && shown.found.includes(artifact.id);
  const changes = squareChanges(def, selected);
  const canGo = targets.includes(selected);
  const isLast = selected === lastSquare(map);

  return createPortal(
    <div
      className={`${pixelFont.variable} dark fixed inset-0 z-50 flex justify-center bg-[#02030a]/90 pt-[env(safe-area-inset-top)]`}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="eo-map-title"
        data-testid="eo-map-dialog"
        data-mode={isChoosing ? "choose" : "view"}
        className="lm-fade-up flex h-full w-full max-w-3xl flex-col bg-slate-950 text-amber-50"
      >
        <div className="flex items-center justify-between gap-3 border-b-4 border-cyan-700/60 px-3 py-3">
          <RetroHeading as="h2" id="eo-map-title" className="text-sm">
            {map.title}
          </RetroHeading>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close the map"
            className={`${pixelClass} inline-flex min-h-11 min-w-11 touch-manipulation items-center justify-center border-2 border-slate-500 bg-slate-900 px-3 text-[10px] text-slate-100 hover:bg-slate-800 ${retroFocusClass}`}
          >
            ✕ Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-3 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))]">
          <div className="space-y-4 lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-4 lg:space-y-0">
            <div className="space-y-3">
              <p className="font-mono text-sm text-slate-200">
                {isChoosing
                  ? "Run finished! Pick where your next run is played: a new square to the right or below, or any square you've been to."
                  : state.done
                    ? "You reached the last square. The chart is yours to wander."
                    : "You are here. Finish this run to take your next step."}
              </p>
              <p
                className={`${pixelClass} text-[10px] leading-relaxed text-cyan-200`}
              >
                → {map.rightLabel} · ↓ {map.downLabel}
              </p>
              <div className="mx-auto w-full max-w-[min(100%,60dvh)]">
                <MapGrid
                  def={def}
                  state={shown}
                  selected={selected}
                  choosable={targets}
                  onSelect={setSelected}
                />
              </div>
            </div>
            <div className="space-y-4">
              <section
                aria-live="polite"
                data-testid="eo-map-detail"
                className="space-y-2 border-2 border-slate-700 bg-slate-900/80 p-3"
              >
                <p className={`${pixelClass} text-[10px] text-cyan-200`}>
                  {map.rightLabel} {square.x + 1} · {map.downLabel}{" "}
                  {square.y + 1}
                  {selected === state.at ? " · you are here" : ""}
                </p>
                {changes.length === 0 ? (
                  <p className="font-mono text-sm text-slate-300">
                    Nothing changes here.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {changes.map((c) => (
                      <li
                        key={c.text}
                        className="font-mono text-sm text-slate-100"
                      >
                        {c.text}
                      </li>
                    ))}
                  </ul>
                )}
                {artifact && !isFound && (
                  <p className="font-mono text-sm text-violet-200">
                    Something strange is here. Finish a run on this square to
                    find out what it is.
                  </p>
                )}
                {artifact && isFound && (
                  <div className="flex gap-2">
                    <Glyph
                      glyph={artifact.glyph}
                      palette={artifact.palette}
                      className="h-8 w-8 shrink-0"
                    />
                    <p className="font-mono text-sm text-amber-100">
                      Found here: {artifact.name}
                    </p>
                  </div>
                )}
                {isLast && (
                  <p className="font-mono text-sm text-amber-200">
                    The last square. Finish a run here to end the voyage.
                  </p>
                )}
                {canGo && (
                  <button
                    type="button"
                    data-testid="eo-map-go"
                    onClick={() => onStep(selected)}
                    className={`${retroPrimaryButtonClass} w-full`}
                  >
                    {selected === state.at
                      ? "Play this square again"
                      : "Play the next run here"}
                  </button>
                )}
                {isChoosing && !canGo && (
                  <p className="font-mono text-xs text-slate-400">
                    You can&apos;t reach this square from here yet.
                  </p>
                )}
              </section>
              <ArtifactShelf
                def={def}
                universe={
                  shown === state ? universe : { ...universe, map: shown }
                }
                onToggle={onToggle}
              />
            </div>
          </div>
        </div>
      </div>
      {isRevealing && find && (
        <ArtifactReveal artifact={find} onDone={() => setIsRevealDone(true)} />
      )}
    </div>,
    document.body
  );
}
