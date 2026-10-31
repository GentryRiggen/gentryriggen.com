"use client";

import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import ChoiceRow from "./ChoiceRow";
import { BREAK_MODE_OPTIONS } from "./seaTrialText";

const CHOICES = BREAK_MODE_OPTIONS.map(({ mode, label, Icon }) => ({
  value: mode,
  label,
  Icon,
}));

/**
 * Picks how an iceberg or storm trial may break the ship: as the build
 * decides, always in two, or never. The choice lasts for the session.
 */
export default function BreakModeSwitch() {
  const breakMode = useShipBuilderStore((s) => s.breakMode);
  const setBreakMode = useShipBuilderStore((s) => s.setBreakMode);
  const current =
    BREAK_MODE_OPTIONS.find((option) => option.mode === breakMode) ??
    BREAK_MODE_OPTIONS[0];

  return (
    <ChoiceRow
      label="How she breaks"
      options={CHOICES}
      value={breakMode}
      onChange={setBreakMode}
      help={current.help}
    />
  );
}
