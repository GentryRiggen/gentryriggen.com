"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

interface ShortLabelProps {
  /** The short label the server wrote, or undefined to show `full` as is. */
  short?: string;
  /** The real text, shown in full when the label is tapped. */
  full: string;
  /** Classes for the visible label (color, strike-through). */
  className?: string;
  /** Attribute for tests and styling hooks on the label text. */
  dataTitle?: boolean;
}

/**
 * A short plain label for a row, with the real text one tap away. With no
 * `short` it is just the text. The tap target is 44px tall; the full text opens
 * inline below, smaller and quieter, and a second tap closes it.
 */
export default function ShortLabel({
  short,
  full,
  className = "text-ayu-text",
  dataTitle,
}: ShortLabelProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  if (!short || short === full) {
    return (
      <span
        {...(dataTitle ? { "data-title": true } : {})}
        className={`block [overflow-wrap:anywhere] ${className}`}
      >
        {full}
      </span>
    );
  }
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className={`flex min-h-11 w-full items-center gap-1.5 rounded-lg text-left [overflow-wrap:anywhere] hover:text-ayu-accent ${className}`}
      >
        <span
          {...(dataTitle ? { "data-title": true } : {})}
          className="min-w-0"
        >
          {short}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`size-4 shrink-0 text-ayu-subtle transition-transform duration-150 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <span
          id={id}
          className="mb-1 block text-sm text-ayu-subtle [overflow-wrap:anywhere]"
        >
          {full}
        </span>
      )}
    </>
  );
}
