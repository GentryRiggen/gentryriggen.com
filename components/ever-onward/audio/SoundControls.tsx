"use client";

import ChannelToggles from "../../game-audio/ChannelToggles";
import { focusRingClass } from "../styles";
import { everOnwardChannels } from "./soundSettings";

const BUTTON =
  "inline-flex touch-manipulation items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700";
const PRESSED =
  "inline-flex touch-manipulation items-center justify-center rounded-lg border border-amber-500 bg-amber-100 text-amber-950 hover:bg-amber-200 dark:border-amber-400 dark:bg-amber-900/50 dark:text-amber-100 dark:hover:bg-amber-900/70";

/** Music and sound-effects switches for the game header. */
export default function SoundControls() {
  return (
    <ChannelToggles
      settings={everOnwardChannels}
      isSoundOn
      buttonClass={`${BUTTON} ${focusRingClass}`}
      pressedButtonClass={`${PRESSED} ${focusRingClass}`}
    />
  );
}
