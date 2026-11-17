/** Shared Tailwind class strings for the Flamelings screens. */

export const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500 focus-visible:ring-offset-2";

/** Big, round, friendly buttons: at least 64px on every side. */
export const BIG_BUTTON = `min-h-16 min-w-16 rounded-3xl font-bold shadow-md active:scale-95 transition-transform disabled:opacity-40 disabled:active:scale-100 ${FOCUS_RING}`;

export const PRIMARY_BUTTON = `${BIG_BUTTON} bg-orange-500 px-8 py-4 text-xl text-white hover:bg-orange-600 dark:bg-orange-400 dark:text-stone-900 dark:hover:bg-orange-300`;

/** The page behind the Shelf, Hatch and Wardrobe screens. */
export const CHROME_BG =
  "bg-gradient-to-b from-amber-100 to-orange-200 text-stone-900 dark:from-slate-900 dark:to-indigo-950 dark:text-amber-50";

export const CARD =
  "rounded-3xl bg-white/80 shadow-md dark:bg-slate-800/80 dark:shadow-black/30";

/** Safe areas, so nothing hides under a notch or the home bar. */
export const SAFE_TOP = "pt-[max(0.75rem,env(safe-area-inset-top))]";
export const SAFE_BOTTOM = "pb-[max(0.75rem,env(safe-area-inset-bottom))]";
export const SAFE_SIDES =
  "pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]";
