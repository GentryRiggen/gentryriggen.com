/** Shared classes for the night HUD: dark translucent panels, big targets. */

export const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300";

/** A dark glass panel that reads over the night scene. */
export const PANEL =
  "rounded-2xl border border-white/10 bg-slate-950/75 text-slate-100 shadow-lg shadow-black/40 backdrop-blur-md dark:bg-slate-950/75";

/** A round 64 px icon button. */
export const ROUND = `pointer-events-auto grid size-16 shrink-0 touch-manipulation place-items-center rounded-full border border-white/15 bg-slate-950/70 text-slate-100 shadow-lg shadow-black/40 backdrop-blur-md active:scale-95 dark:bg-slate-950/70 ${FOCUS}`;

/** The same, switched on. */
export const ROUND_ON = `pointer-events-auto grid size-16 shrink-0 touch-manipulation place-items-center rounded-full border border-sky-300 bg-sky-500/85 text-white shadow-lg shadow-black/40 active:scale-95 ${FOCUS}`;

/** A big pill for the title and end card choices. */
export const BIG_BUTTON = `pointer-events-auto inline-flex min-h-16 touch-manipulation items-center justify-center gap-3 rounded-full px-7 text-xl font-semibold shadow-lg active:scale-95 ${FOCUS}`;

export const PRIMARY = `${BIG_BUTTON} border border-sky-300 bg-sky-500 text-white hover:bg-sky-400`;
export const SECONDARY = `${BIG_BUTTON} border border-white/20 bg-slate-900/80 text-slate-100 hover:bg-slate-800`;
