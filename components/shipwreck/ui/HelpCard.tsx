"use client";

import { useEffect, useRef } from "react";
import { SAFE_INSETS } from "@/lib/game-kit/safeArea";
import type { Help } from "@/lib/shipwreck/help";
import Icon, { type IconName } from "./Icon";
import { FOCUS, PANEL, PRIMARY } from "./styles";

interface HelpCardProps {
  help: Help;
  icon: IconName;
  onClose: () => void;
}

/** "What is this?": a calm card explaining a HUD item. */
export default function HelpCard({ help, icon, onClose }: HelpCardProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      className={`fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-black/40 p-4 ${SAFE_INSETS}`}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={help.title}
        data-testid="shipwreck-help"
        onClick={(e) => e.stopPropagation()}
        className={`${PANEL} flex w-full max-w-md flex-col gap-4 p-5 sm:p-6`}
      >
        <div className="flex items-center gap-4">
          <div className="grid size-16 shrink-0 place-items-center rounded-full bg-sky-500/20 text-sky-200">
            <Icon name={icon} className="size-9" />
          </div>
          <div className="min-w-0">
            <h2 className="text-2xl font-semibold leading-tight text-white">
              {help.title}
            </h2>
            {help.now && (
              <p
                data-testid="shipwreck-help-now"
                className="mt-1 text-lg font-semibold text-sky-200"
              >
                {help.now}
              </p>
            )}
          </div>
        </div>
        <ul className="flex flex-col gap-2">
          {help.lines.map((line) => (
            <li
              key={line}
              className="rounded-xl bg-white/5 px-3 py-2 text-lg leading-snug text-slate-100"
            >
              {line}
            </li>
          ))}
        </ul>
        <div className="flex justify-end">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className={`${PRIMARY} ${FOCUS}`}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
