"use client";

import useTrialChoices from "../hooks/useTrialChoices";
import ChoiceRow from "./ChoiceRow";
import { LIFEBOAT_CHOICES } from "./seaTrialText";

/**
 * How people board the boats when she sinks: like the Titanic (some boats
 * leave half-empty) or filling every seat. Remembered on the device.
 */
export default function LifeboatSwitch() {
  const { lifeboats, setLifeboats } = useTrialChoices();
  return (
    <ChoiceRow
      label="Lifeboats"
      options={LIFEBOAT_CHOICES}
      value={lifeboats}
      onChange={setLifeboats}
    />
  );
}
