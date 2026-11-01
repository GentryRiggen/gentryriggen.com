"use client";

import { useState } from "react";
import { useAnimatedNumber } from "./useAnimatedNumber";

interface AnimatedValueProps {
  value: number;
  format: (value: number) => string;
  className?: string;
  testId?: string;
}

type Flash = { direction: "rise" | "fall"; id: number } | null;

/** A change this big (share of the old value) flashes; small drift doesn't. */
const FLASH_SHARE = 0.03;

/** A number that counts toward its value and pulses green up, red down. */
export default function AnimatedValue({
  value,
  format,
  className = "",
  testId,
}: AnimatedValueProps) {
  const shown = useAnimatedNumber(value);
  const [previous, setPrevious] = useState(value);
  const [flash, setFlash] = useState<Flash>(null);

  if (value !== previous) {
    const change = value - previous;
    setPrevious(value);
    if (Math.abs(change) >= Math.abs(previous) * FLASH_SHARE) {
      setFlash((f) => ({
        direction: change > 0 ? "rise" : "fall",
        id: (f?.id ?? 0) + 1,
      }));
    }
  }

  const flashClass = flash
    ? flash.direction === "rise"
      ? "lm-rise"
      : "lm-fall"
    : "";

  return (
    <span
      key={flash?.id ?? 0}
      data-testid={testId}
      className={`inline-block tabular-nums ${flashClass} ${className}`}
    >
      {format(shown)}
    </span>
  );
}
