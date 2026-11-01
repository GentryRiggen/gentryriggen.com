/** Shared classes for the retro screens (start, hub, versions). */

export const retroFocusClass =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b1233]";

export const retroLinkClass = `rounded px-1 py-1 underline decoration-slate-600 underline-offset-4 hover:text-amber-200 ${retroFocusClass}`;

/** Pixel title text: drop shadow and glow. */
export const retroHeadingClass =
  "text-amber-300 [text-shadow:2px_2px_0_#78350f] drop-shadow-[0_0_8px_rgba(251,191,36,0.45)]";

/** A chunky pixel panel: square corners, thick border, hard shadow. */
export const retroPanelClass =
  "border-4 border-amber-500/80 bg-slate-950/85 shadow-[4px_4px_0_#78350f]";
