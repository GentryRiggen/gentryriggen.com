/**
 * Shared Tailwind class strings for the Flamelings screens.
 *
 * A token owns the properties it sets. There is no tailwind-merge here, and
 * whichever utility comes later in the built CSS wins, not the one written
 * last, so a caller must not re-set a token's display, colour, padding or text
 * size. Use a `_BASE` / `PILL` variant and set those yourself instead.
 */

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
const ROUND_CORE = `min-h-16 min-w-16 rounded-full transition-transform active:translate-y-[3px] disabled:opacity-40 disabled:active:translate-y-0 ${FOCUS_RING}`;
const ROUND_BUTTON = `grid place-items-center text-[#3a2340] ${ROUND_CORE}`;
export const STICKER_BUTTON = `${ROUND_BUTTON} bg-[#fff6e6] shadow-[0_4px_0_#e7c9a3,0_8px_18px_rgba(30,10,40,.25)] active:shadow-[0_2px_0_#e7c9a3]`;
/** The cream sticker with no display or text colour, for a pill that sets its own (flex, icon beside words). */
export const STICKER_PILL = `${ROUND_CORE} bg-[#fff6e6] shadow-[0_4px_0_#e7c9a3,0_8px_18px_rgba(30,10,40,.25)] active:shadow-[0_2px_0_#e7c9a3]`;
/** The sticker button in peach, for use on a cream card. */
export const PEACH_BUTTON = `${ROUND_BUTTON} bg-[#ffd9b0] shadow-[0_4px_0_#e0a46a,0_8px_18px_rgba(30,10,40,.2)] active:shadow-[0_2px_0_#e0a46a]`;

/** The orange button with no padding or text size, for a caller that sets its own. */
export const PRIMARY_BUTTON_BASE = `${DISPLAY} min-h-16 min-w-16 rounded-3xl bg-gradient-to-b from-[#ff8a3d] to-[#f2542d] font-semibold text-white shadow-[0_5px_0_#c2410c,0_10px_20px_rgba(30,10,40,.30)] transition-transform active:translate-y-[3px] active:shadow-[0_2px_0_#c2410c] disabled:opacity-40 disabled:active:translate-y-0 ${FOCUS_RING}`;
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
  "relative overflow-hidden rounded-[30px] border-2 border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,.62),rgba(255,255,255,.30))] text-[#3a2340] shadow-[inset_0_0_56px_rgba(255,140,60,.22),0_10px_24px_rgba(58,35,64,.14)] dark:border-[rgba(255,230,200,.22)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,.11),rgba(255,255,255,.04))] dark:text-[#ffe6c4] dark:shadow-[inset_0_0_60px_rgba(255,140,60,.16),0_10px_24px_rgba(0,0,0,.25)]";

/** The dimmed dusk behind a dialog card. */
export const DIALOG_BACKDROP = "bg-[#1b1430]/55";

/** A tab chip: a cream sticker with an icon; callers add TAB_ON or TAB_OFF. */
export const TAB_CHIP = `${DISPLAY} flex min-h-16 shrink-0 items-center justify-center gap-2 rounded-full px-4 py-2 text-lg font-semibold transition-transform active:translate-y-[3px] ${FOCUS_RING}`;
export const TAB_ON =
  "bg-gradient-to-b from-[#ff8a3d] to-[#f2542d] text-white shadow-[0_4px_0_#c2410c,0_8px_16px_rgba(30,10,40,.22)]";
/** The cream disc a tab chip's icon sits on, so it shows on orange too. */
export const TAB_ICON_DISC =
  "-ml-2 grid size-11 shrink-0 place-items-center rounded-full bg-[#fff6e6] shadow-[inset_0_-3px_0_rgba(194,120,60,.18)]";
export const TAB_OFF =
  "bg-[#fff6e6] text-[#3a2340] shadow-[0_4px_0_#e7c9a3,0_8px_16px_rgba(30,10,40,.18)]";
/** An unselected chip on a cream card. */
export const TAB_OFF_ON_CREAM =
  "bg-[#ffe9cc] text-[#3a2340] shadow-[0_4px_0_#e7c9a3]";

/** The cream tray that slides up above the dock (food, emotes). */
export const TRAY =
  "fl-sheet-up rounded-[30px] bg-[#fff6e6]/95 p-3 text-[#3a2340] shadow-[0_6px_0_#e2c19a,0_18px_40px_rgba(30,10,40,.40)]";

/** A tile in a tray: a soft peach square that squishes when pressed. */
export const TRAY_TILE = `relative grid size-20 place-items-center rounded-3xl bg-[#ffe9cc] shadow-[inset_0_-5px_0_rgba(194,120,60,.25)] transition-transform active:translate-y-[2px] disabled:bg-[#f3e6d6] sm:size-24 ${FOCUS_RING}`;

/** The soft glow an item sits on in the shop and the wardrobe. */
export const SPOTLIGHT =
  "bg-[radial-gradient(circle_at_50%_55%,#ffe2b0_0%,rgba(255,226,176,.55)_40%,rgba(255,226,176,0)_70%)]";

/** The Done button at the top right of a full-screen panel (narrower on phones). */
export const DONE_BUTTON = `${PRIMARY_BUTTON} max-sm:px-5`;

/** A mini-game's score: the gold spark pill. */
export const SCORE_CHIP = `${DISPLAY} flex h-16 shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-b from-[#ffe58a] to-[#ffc53d] px-4 text-2xl font-bold text-[#7a3d00] shadow-[0_4px_0_#d9952a,0_8px_18px_rgba(30,10,40,.25)] sm:px-5`;

/** A mini-game's timer or count: a cream chip beside the score. */
export const TIMER_CHIP = `${DISPLAY} flex h-16 shrink-0 items-center gap-1.5 rounded-full bg-[#fff6e6] px-4 text-2xl font-bold tabular-nums text-[#3a2340] shadow-[0_4px_0_#e7c9a3,0_8px_18px_rgba(30,10,40,.25)] sm:px-5`;

export const CARD =
  "rounded-3xl bg-[#fff6e6] text-[#3a2340] shadow-[0_5px_0_#e7c9a3,0_12px_28px_rgba(30,10,40,.30)]";

export { SAFE_BOTTOM, SAFE_SIDES, SAFE_TOP } from "@/lib/game-kit/safeArea";
