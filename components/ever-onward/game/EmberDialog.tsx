"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { prestigeLabel } from "@/lib/ever-onward/engine/prestige";
import type { UniverseDef, UniverseSave } from "@/lib/ever-onward/engine/types";
import EmberPanel from "./EmberPanel";
import RetroHeading from "./retro/RetroHeading";
import {
  pixelClass,
  pixelFont,
  retroFocusClass,
  retroPanelClass,
} from "./retro/retroStyles";

interface EmberDialogProps {
  def: UniverseDef;
  universe: UniverseSave;
  onBuy: (id: string) => void;
  onRestart: () => void;
  onClose: () => void;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Embers, the permanent upgrades and the restart button in a bottom sheet
 * (phones) or side panel (wide screens). Same shape as the story drawer.
 */
export default function EmberDialog({
  def,
  universe,
  onBuy,
  onRestart,
  onClose,
}: EmberDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Focus Close once, when the dialog opens (not on every re-render).
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

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

  return createPortal(
    <div
      className={`${pixelFont.variable} dark fixed inset-0 z-50 flex items-end lg:items-stretch lg:justify-end`}
    >
      <div
        aria-hidden="true"
        data-testid="lm-ember-backdrop"
        onClick={onClose}
        className="absolute inset-0 bg-[#02030a]/80"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lm-ember-title"
        data-testid="lm-ember-dialog"
        className={`${retroPanelClass} lm-fade-up relative flex max-h-[85dvh] w-full flex-col !bg-slate-950 text-amber-50 lg:max-h-none lg:max-w-xl lg:border-y-0 lg:border-r-0`}
      >
        <div className="flex items-center justify-between gap-3 border-b-4 border-amber-500/60 p-3">
          <RetroHeading as="h2" id="lm-ember-title" className="text-sm">
            {prestigeLabel(def)}
          </RetroHeading>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={`Close ${prestigeLabel(def).toLowerCase()}`}
            className={`${pixelClass} inline-flex min-h-11 min-w-11 touch-manipulation items-center justify-center border-2 border-slate-500 bg-slate-900 px-3 text-[10px] text-slate-100 hover:bg-slate-800 ${retroFocusClass}`}
          >
            ✕ Close
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain p-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <EmberPanel
            def={def}
            universe={universe}
            onBuy={onBuy}
            onRestart={() => {
              onRestart();
              onClose();
            }}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
