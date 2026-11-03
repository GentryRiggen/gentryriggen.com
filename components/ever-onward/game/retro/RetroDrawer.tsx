"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import RetroHeading from "./RetroHeading";
import {
  pixelClass,
  pixelFont,
  retroFocusClass,
  retroPanelClass,
} from "./retroStyles";

interface RetroDrawerProps {
  title: string;
  /** Test id for the dialog panel. */
  testId?: string;
  onClose: () => void;
  children: ReactNode;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A bottom sheet (phones) or side panel (wide screens) with a title, a Close
 * button, a backdrop, Escape to close and a focus trap. The caller returns
 * focus to whatever opened it.
 */
export default function RetroDrawer({
  title,
  testId,
  onClose,
  children,
}: RetroDrawerProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Focus Close once, when the drawer opens.
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
      className={`${pixelFont.variable} dark fixed inset-0 z-50 flex items-end pt-[env(safe-area-inset-top)] lg:items-stretch lg:justify-end`}
    >
      <div
        aria-hidden="true"
        data-testid={testId ? `${testId}-backdrop` : undefined}
        onClick={onClose}
        className="absolute inset-0 bg-[#02030a]/80"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid={testId}
        className={`${retroPanelClass} lm-fade-up relative flex max-h-[85dvh] w-full flex-col !bg-slate-950 text-amber-50 lg:max-h-none lg:max-w-xl lg:border-y-0 lg:border-r-0`}
      >
        <div className="flex items-center justify-between gap-3 border-b-4 border-amber-500/60 p-3">
          <RetroHeading as="h2" id={titleId} className="text-sm">
            {title}
          </RetroHeading>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={`Close ${title.toLowerCase()}`}
            className={`${pixelClass} inline-flex min-h-11 min-w-11 touch-manipulation items-center justify-center border-2 border-slate-500 bg-slate-900 px-3 text-[10px] text-slate-100 hover:bg-slate-800 ${retroFocusClass}`}
          >
            ✕ Close
          </button>
        </div>
        <div className="space-y-5 overflow-y-auto overscroll-contain p-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
