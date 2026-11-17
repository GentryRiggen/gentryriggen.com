/** Shared Tailwind class strings for the Flamelings screens. */

export const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500 focus-visible:ring-offset-2";

/** The rounded storybook display font (Fredoka), set by the Flamelings shell. */
export const DISPLAY = "font-[family-name:var(--font-fl-display)]";

/** Big, round, friendly buttons: at least 64px on every side. Callers add the colours. */
export const BIG_BUTTON = `min-h-16 min-w-16 rounded-3xl font-semibold shadow-[0_4px_0_rgba(58,35,64,.28),0_8px_18px_rgba(30,10,40,.22)] transition-transform active:translate-y-[3px] active:shadow-[0_1px_0_rgba(58,35,64,.28)] disabled:opacity-40 disabled:active:translate-y-0 ${FOCUS_RING}`;

/** A cream panel: the storybook card used in both themes. */
export const STICKER =
  "rounded-[28px] bg-[#fff6e6] text-[#3a2340] shadow-[0_5px_0_#e7c9a3,0_12px_28px_rgba(30,10,40,.30)]";

/** A cream round button, 64px or more, that squishes when pressed. */
export const STICKER_BUTTON = `grid min-h-16 min-w-16 place-items-center rounded-full bg-[#fff6e6] text-[#3a2340] shadow-[0_4px_0_#e7c9a3,0_8px_18px_rgba(30,10,40,.25)] transition-transform active:translate-y-[3px] active:shadow-[0_2px_0_#e7c9a3] disabled:opacity-40 disabled:active:translate-y-0 ${FOCUS_RING}`;

export const PRIMARY_BUTTON = `${DISPLAY} min-h-16 min-w-16 rounded-3xl bg-gradient-to-b from-[#ff8a3d] to-[#f2542d] px-8 py-4 text-xl font-semibold text-white shadow-[0_5px_0_#c2410c,0_10px_20px_rgba(30,10,40,.30)] transition-transform active:translate-y-[3px] active:shadow-[0_2px_0_#c2410c] disabled:opacity-40 disabled:active:translate-y-0 ${FOCUS_RING}`;

/** The gold pill that holds the spark count. */
export const SPARK_PILL = `${DISPLAY} flex h-16 shrink-0 items-center gap-1 rounded-full bg-gradient-to-b from-[#ffe58a] to-[#ffc53d] px-2.5 text-xl font-bold text-[#7a3d00] shadow-[0_4px_0_#d9952a,0_8px_18px_rgba(30,10,40,.25)] sm:gap-2 sm:px-4 sm:text-2xl`;

/** The page behind every screen: dusk in the dark, peach and lavender in the light. */
export const CHROME_BG =
  "bg-[linear-gradient(180deg,#ffe3c4_0%,#f3c9d9_55%,#d9c6ef_100%)] text-[#3a2340] dark:bg-[radial-gradient(ellipse_at_50%_30%,#4b2f6b_0%,#2a1d47_55%,#1b1430_100%)] dark:text-[#fff6e6]";

/**
 * A glass jar: translucent, a thin light rim and a warm glow inside. Used for
 * pets on the shelf and friends; callers add size, layout and padding.
 */
export const JAR_CARD =
  "relative overflow-hidden rounded-[30px] border-2 border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,.62),rgba(255,255,255,.30))] text-[#3a2340] shadow-[inset_0_0_56px_rgba(255,140,60,.22),0_10px_24px_rgba(58,35,64,.14)] backdrop-blur-[2px] dark:border-[rgba(255,230,200,.22)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,.11),rgba(255,255,255,.04))] dark:text-[#ffe6c4] dark:shadow-[inset_0_0_60px_rgba(255,140,60,.16),0_10px_24px_rgba(0,0,0,.25)]";

export const CARD =
  "rounded-3xl bg-[#fff6e6] text-[#3a2340] shadow-[0_5px_0_#e7c9a3,0_12px_28px_rgba(30,10,40,.30)]";

export { SAFE_BOTTOM, SAFE_SIDES, SAFE_TOP } from "@/lib/game-kit/safeArea";
