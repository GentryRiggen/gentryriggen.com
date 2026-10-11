const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-700 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-sky-300 dark:focus-visible:ring-offset-slate-900";

/** Keyboard focus ring for anything clickable that is not one of the buttons. */
export const focusRingClass = focusRing;

const base = `inline-flex min-h-11 touch-manipulation items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`;

export const primaryButtonClass = `${base} bg-sky-600 text-white hover:bg-sky-500 dark:bg-sky-500 dark:hover:bg-sky-400`;

export const secondaryButtonClass = `${base} border border-slate-300 bg-white text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700`;

export const dangerButtonClass = `${base} bg-red-600 text-white hover:bg-red-500 dark:bg-red-500 dark:hover:bg-red-400`;

export const coinButtonClass = `${base} bg-amber-400 text-amber-950 hover:bg-amber-300 dark:bg-amber-500 dark:hover:bg-amber-400`;

export const cardClass =
  "rounded-2xl border border-slate-200 bg-white/95 text-slate-900 shadow-lg dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100";
