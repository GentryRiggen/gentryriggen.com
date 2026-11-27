"use client";

import { useEffect, useState } from "react";

const GLYPHS = ["·", "✢", "✳", "✶", "✻", "✽", "✻", "✶", "✳", "✢"];

export const SPINNER_VERBS = [
  "Mentoring",
  "Shipping",
  "Refactoring",
  "Code reviewing",
  "Whiteboarding",
  "Unblocking",
  "Deploying",
  "Caffeinating",
  "Hiring",
  "Pairing",
];

interface SpinnerProps {
  verb: string;
}

/** Claude Code's thinking line: a twinkling glyph and a whimsical verb. */
export default function Spinner({ verb }: SpinnerProps) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setFrame((f) => f + 1), 120);
    return () => clearInterval(id);
  }, []);

  return (
    <p className="mb-5 text-term-accent" aria-hidden="true">
      <span className="inline-block w-4" aria-hidden="true">
        {GLYPHS[frame % GLYPHS.length]}
      </span>{" "}
      {verb}…{" "}
      <span className="text-term-muted">(tap or press any key to skip)</span>
    </p>
  );
}
