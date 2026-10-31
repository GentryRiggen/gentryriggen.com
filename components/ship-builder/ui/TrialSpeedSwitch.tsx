"use client";

import {
  ChevronsRight,
  FastForward,
  Play,
  Rabbit,
  Rocket,
  Zap,
} from "lucide-react";
import useTrialSpeed, { TRIAL_SPEEDS } from "../hooks/useTrialSpeed";
import ChoiceRow from "./ChoiceRow";

const ICONS = {
  1: Play,
  2: FastForward,
  3: ChevronsRight,
  5: Rabbit,
  10: Rocket,
  20: Zap,
} as const;

const OPTIONS = TRIAL_SPEEDS.map((speed) => ({
  value: speed,
  label: `${speed}x`,
  Icon: ICONS[speed],
}));

/** Picks how fast the trial plays: 1x up to 20x. Never changes the outcome. */
export default function TrialSpeedSwitch() {
  const { speed, setSpeed } = useTrialSpeed();
  return (
    <ChoiceRow
      variant="pill"
      label="Speed"
      options={OPTIONS}
      value={speed}
      onChange={setSpeed}
    />
  );
}
