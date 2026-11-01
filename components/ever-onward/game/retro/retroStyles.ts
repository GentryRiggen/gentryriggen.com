import { Press_Start_2P } from "next/font/google";

/**
 * The arcade pixel font, self-hosted by Next at build time. `variable` puts
 * it on a CSS custom property that the game screen's root element carries,
 * so any class below works anywhere inside the game (overlays included).
 */
export const pixelFont = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-eo-pixel",
});

/** Pixel text for headings, labels and HUD numbers. */
export const pixelClass =
  "font-[family-name:var(--font-eo-pixel)] uppercase leading-snug";

/** Readable body text: the same mono the hub uses for descriptions. */
export const bodyClass = "font-mono text-sm text-slate-200";

export const retroFocusClass =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b1233]";

/** Pixel title text: drop shadow and glow. */
export const retroHeadingClass =
  "text-amber-300 [text-shadow:2px_2px_0_#78350f] drop-shadow-[0_0_8px_rgba(251,191,36,0.45)]";

/** Small cyan label above a value. */
export const retroLabelClass = `${pixelClass} text-[8px] leading-none text-cyan-200`;

/** A chunky pixel panel: square corners, thick border, hard shadow. */
export const retroPanelClass =
  "border-4 border-amber-500/80 bg-slate-950/85 shadow-[4px_4px_0_#78350f]";

/** The quiet sibling for things the player can't act on yet. */
export const retroQuietPanelClass =
  "border-4 border-slate-700 bg-slate-950/85 shadow-[4px_4px_0_#0f172a]";

/** A small inset box (a stat, a field). */
export const retroInsetClass = "border-2 border-slate-700 bg-slate-900/80";

const buttonBase = `${pixelClass} inline-flex min-h-11 touch-manipulation select-none items-center justify-center gap-2 border-4 px-4 py-2 text-[10px] transition-transform active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:opacity-40 disabled:active:translate-y-0 ${retroFocusClass}`;

export const retroPrimaryButtonClass = `${buttonBase} border-amber-300 bg-amber-950/60 text-amber-300 shadow-[3px_3px_0_#78350f] hover:bg-amber-900/70`;

export const retroSecondaryButtonClass = `${buttonBase} border-slate-500 bg-slate-900 text-slate-100 shadow-[3px_3px_0_#0f172a] hover:bg-slate-800`;

export const retroDangerButtonClass = `${buttonBase} border-red-400 bg-red-950/70 text-red-200 shadow-[3px_3px_0_#450a0a] hover:bg-red-900/70`;

/** Text inputs and the backup textareas. */
export const retroFieldClass = `w-full border-2 border-slate-600 bg-slate-950 p-2 font-mono text-xs text-slate-100 disabled:opacity-40 ${retroFocusClass}`;
