import { useEffect, useRef } from "react";
import type { Help } from "@/lib/flamelings/help";
import { SAFE_INSETS } from "@/lib/game-kit/safeArea";
import FlIcon, { type FlIconName } from "./FlIcon";
import {
  DIALOG_BACKDROP,
  DISPLAY,
  FOCUS_RING,
  PEACH_BUTTON,
  PRIMARY_BUTTON,
  STICKER,
} from "./styles";

/** A sticker that explains itself when tapped: a clear button over it. */
export function HelpTap({
  label,
  onOpen,
  className = "rounded-full",
}: {
  label: string;
  onOpen?: () => void;
  className?: string;
}) {
  if (!onOpen) return null;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      className={`absolute inset-0 ${className} ${FOCUS_RING}`}
    />
  );
}

/** Wraps a sticker so it squishes while its help button is pressed. */
export const PRESSABLE =
  "relative transition-transform has-[>button:active]:translate-y-[2px]";

const RING_RADIUS = 30;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

interface HelpCardProps {
  help: Help;
  icon: FlIconName;
  /** The ring colour, for a need. */
  colour?: string;
  /** A button that does the thing the card talks about ("Feed"). */
  action?: { label: string; onClick: () => void };
  onClose: () => void;
}

/** "What is this?": a card explaining a gauge, the level or sparks. */
export default function HelpCard({
  help,
  icon,
  colour = "#ff8a3d",
  action,
  onClose,
}: HelpCardProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  // The pet view re-renders every clock tick: keep the latest onClose without
  // re-running the effect (which would steal focus each time).
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

  const fraction =
    help.value === undefined ? 1 : Math.min(1, Math.max(0, help.value / 100));
  const low = help.value !== undefined && help.value < 30;

  return (
    <div
      className={`fl-fade-in fixed inset-0 z-[35] grid place-items-center overflow-y-auto p-3 ${DIALOG_BACKDROP} ${SAFE_INSETS}`}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={help.title}
        data-testid="help-card"
        onClick={(e) => e.stopPropagation()}
        className={`${STICKER} fl-pop-in flex w-[calc(100%-2rem)] max-w-md flex-col gap-4 p-5 sm:p-6`}
      >
        <div className="flex items-center gap-4">
          <div className="relative grid size-20 shrink-0 place-items-center rounded-full bg-white">
            {help.value !== undefined && (
              <svg
                viewBox="0 0 72 72"
                aria-hidden="true"
                className="absolute inset-0"
              >
                <circle
                  cx="36"
                  cy="36"
                  r={RING_RADIUS}
                  fill="none"
                  stroke="#f3dcc0"
                  strokeWidth="7"
                />
                <circle
                  cx="36"
                  cy="36"
                  r={RING_RADIUS}
                  fill="none"
                  stroke={low ? "#ef4444" : colour}
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray={RING_LENGTH}
                  strokeDashoffset={RING_LENGTH * (1 - fraction)}
                  transform="rotate(-90 36 36)"
                />
              </svg>
            )}
            <FlIcon name={icon} className="size-9" />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              className={`${DISPLAY} text-3xl font-bold leading-tight text-[#7a3d2c]`}
            >
              {help.title}
            </h2>
            <p
              data-testid="help-now"
              className={`mt-1 text-lg font-extrabold leading-snug ${
                low ? "text-[#dc2626]" : "text-[#7a5a78]"
              }`}
            >
              {help.now}
            </p>
          </div>
        </div>

        <ul className="flex flex-col gap-2.5">
          {help.lines.map((line) => (
            <li
              key={line.text}
              className="flex items-start gap-3 rounded-2xl bg-[#ffe9cc] px-3 py-2.5 text-lg font-semibold leading-snug"
            >
              <span aria-hidden="true" className="text-2xl leading-none">
                {line.glyph}
              </span>
              <span>{line.text}</span>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-end gap-3">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className={`${PEACH_BUTTON} ${DISPLAY} px-6 text-xl font-semibold`}
          >
            Got it
          </button>
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              data-testid="help-action"
              className={`${PRIMARY_BUTTON} px-6 py-3`}
            >
              {action.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
