"use client";

import { ghostSetting, useGhostEnabled } from "./ghostSetting";
import { primaryButtonClass, secondaryButtonClass } from "./styles";

/** Turns the ghost plane (your best flight, drawn see-through) on or off. */
export default function GhostToggle() {
  const isOn = useGhostEnabled();
  return (
    <button
      type="button"
      aria-pressed={isOn}
      aria-label="Ghost plane"
      title={isOn ? "Ghost plane on" : "Ghost plane off"}
      onClick={() => ghostSetting.set(!isOn)}
      className={`min-w-11 px-3 ${isOn ? primaryButtonClass : secondaryButtonClass}`}
    >
      <span aria-hidden="true" className="text-lg leading-none">
        👻
      </span>
    </button>
  );
}
