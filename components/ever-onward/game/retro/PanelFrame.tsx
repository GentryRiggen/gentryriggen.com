import type { ReactNode } from "react";
import { pixelClass } from "./retroStyles";

export type PanelTone =
  "amber" | "sky" | "emerald" | "violet" | "orange" | "lime";

/** Full class names, so Tailwind sees every one of them. */
const TONES: Record<
  PanelTone,
  { frame: string; title: string; icon: string; chip: string }
> = {
  amber: {
    frame: "border-amber-400/80 shadow-[4px_4px_0_#78350f]",
    title: "text-amber-200",
    icon: "text-amber-300",
    chip: "border-amber-300 bg-amber-950 text-amber-100",
  },
  sky: {
    frame: "border-sky-400/80 shadow-[4px_4px_0_#0c4a6e]",
    title: "text-sky-200",
    icon: "text-sky-300",
    chip: "border-sky-300 bg-sky-950 text-sky-100",
  },
  emerald: {
    frame: "border-emerald-400/80 shadow-[4px_4px_0_#064e3b]",
    title: "text-emerald-200",
    icon: "text-emerald-300",
    chip: "border-emerald-300 bg-emerald-950 text-emerald-100",
  },
  violet: {
    frame: "border-violet-400/80 shadow-[4px_4px_0_#4c1d95]",
    title: "text-violet-200",
    icon: "text-violet-300",
    chip: "border-violet-300 bg-violet-950 text-violet-100",
  },
  orange: {
    frame: "border-orange-400/80 shadow-[4px_4px_0_#7c2d12]",
    title: "text-orange-200",
    icon: "text-orange-300",
    chip: "border-orange-300 bg-orange-950 text-orange-100",
  },
  lime: {
    frame: "border-lime-400/80 shadow-[4px_4px_0_#365314]",
    title: "text-lime-200",
    icon: "text-lime-300",
    chip: "border-lime-300 bg-lime-950 text-lime-100",
  },
};

/** The result line's look. Emerald is the default "kind" result. */
const RESULTS = {
  emerald: "border-emerald-400 bg-emerald-950/70 text-emerald-200",
  amber: "border-amber-400 bg-amber-950/70 text-amber-200",
  slate: "border-slate-600 bg-slate-900/80 text-slate-200",
} as const;

export type PanelResultTone = keyof typeof RESULTS;

interface PanelFrameProps {
  /** The region's accessible name. */
  label: string;
  /** The visible heading. */
  title: string;
  /** A decorative glyph before the title. */
  icon?: string;
  tone: PanelTone;
  /** Short chip text beside the title. */
  status?: ReactNode;
  /** A lit chip (in the tone's colour) or a quiet grey one. */
  statusActive?: boolean;
  statusTestId?: string;
  /** The live result line. Always mounted, so a screen reader hears changes. */
  result?: string | null;
  resultTestId?: string;
  resultTone?: PanelResultTone;
  /** Changes when the same line should be announced again. */
  resultKey?: string | number;
  testId?: string;
  /** data-* attributes for the section (tests and styles read them). */
  data?: Record<`data-${string}`, string | number | undefined>;
  /** Extra classes on the section, e.g. "relative isolate overflow-hidden". */
  className?: string;
  /** Decorative background layers, placed before the header. */
  backdrop?: ReactNode;
  /** Rendered after the result line. */
  footer?: ReactNode;
  children?: ReactNode;
}

/**
 * The one frame every side panel wears: a thick tone-coloured border, a
 * heading with an optional status chip, mono body copy, and a polite live
 * region for the result of the last action.
 */
export default function PanelFrame({
  label,
  title,
  icon,
  tone,
  status,
  statusActive = true,
  statusTestId,
  result,
  resultTestId,
  resultTone = "emerald",
  resultKey,
  testId,
  data,
  className = "",
  backdrop,
  footer,
  children,
}: PanelFrameProps) {
  const look = TONES[tone];
  // The live region stays mounted. An invisible mark that flips with the key
  // changes the text, so the same line is announced again.
  const keyNumber =
    typeof resultKey === "number" ? resultKey : (resultKey ?? "").length;
  const nudge = result && keyNumber % 2 === 1 ? "\u200B" : "";
  return (
    <section
      aria-label={label}
      data-testid={testId}
      {...data}
      className={`space-y-3 border-4 bg-slate-950/85 p-3 ${look.frame} ${className}`}
    >
      {backdrop}
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={`${pixelClass} text-xs ${look.title}`}>
          {icon && (
            <span aria-hidden="true" className={`mr-2 ${look.icon}`}>
              {icon}
            </span>
          )}
          {title}
        </h2>
        {status != null && (
          <p
            data-testid={statusTestId}
            className={`${pixelClass} border-2 px-2 py-1 text-[10px] ${
              statusActive
                ? look.chip
                : "border-slate-600 bg-slate-900 text-slate-300"
            }`}
          >
            {status}
          </p>
        )}
      </header>
      {children}
      <p
        role="status"
        aria-live="polite"
        data-testid={resultTestId}
        className={
          result
            ? `border-2 p-2 font-mono text-sm font-bold ${RESULTS[resultTone]}`
            : "sr-only"
        }
      >
        {(result ?? "") + nudge}
      </p>
      {footer}
    </section>
  );
}
