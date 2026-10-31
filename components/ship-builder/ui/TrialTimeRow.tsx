"use client";

import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { DEFAULT_TIME_OF_DAY } from "../scene/timeOfDay";
import ChoiceRow from "./ChoiceRow";
import { TIME_CHOICES } from "./seaTrialText";

/**
 * The time of day row of a setup card (or the iceberg's aim card). It
 * changes only the trial's look, so the scene previews it and the main
 * screen's time stays as it was.
 */
export default function TrialTimeRow() {
  const time = useShipBuilderStore((s) =>
    s.trial.status === "idle" ? DEFAULT_TIME_OF_DAY : s.trial.look.time
  );
  const setTrialLook = useShipBuilderStore((s) => s.setTrialLook);
  return (
    <ChoiceRow
      label="Time"
      options={TIME_CHOICES}
      value={time}
      onChange={(next) => setTrialLook({ time: next })}
    />
  );
}
