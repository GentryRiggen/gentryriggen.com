"use client";

import { useEffect, useState } from "react";
import { liveryHelp, type Help } from "@/lib/shipwreck/help";
import { nextLivery, type ShipSpec } from "@/lib/shipwreck/ships/types";
import Icon from "./Icon";
import { PANEL, ROUND } from "./styles";

/** How long the words under a tap stay up (ms). */
export const LIVERY_HELP_MS = 4500;

const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;

interface LiveryButtonProps {
  spec: ShipSpec;
  /** Her livery now (null: her default). */
  livery: string | null;
  /** Tapped: paint her in `id` (the next livery). */
  onChange: (id: string) => void;
  /** Where the words show: beside the button (the HUD's rail) or above it. */
  bubble?: "left" | "above";
}

/**
 * The paint button (R24): a brush with two swatches of the paint a tap
 * gives her. Each tap paints her in her next livery, live (the run goes
 * on), and says what that paint was. Not there for a ship with one paint.
 */
export default function LiveryButton({
  spec,
  livery,
  onChange,
  bubble = "left",
}: LiveryButtonProps) {
  const [said, setSaid] = useState<Help | null>(null);
  useEffect(() => {
    if (!said) return;
    const id = setTimeout(() => setSaid(null), LIVERY_HELP_MS);
    return () => clearTimeout(id);
  }, [said]);
  const next = nextLivery(spec, livery);
  if (!next) return null;

  const onTap = () => {
    onChange(next.id);
    setSaid(liveryHelp(spec, next.id));
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`Paint: ${next.label}`}
        data-testid="shipwreck-livery"
        data-next={next.id}
        onClick={onTap}
        className={`${ROUND} relative`}
      >
        <Icon name="brush" className="size-8" />
        {/* The next paint's two swatches (SVG fills: the colours are data). */}
        <svg
          viewBox="0 0 26 14"
          aria-hidden="true"
          className="absolute bottom-1 right-1 h-3.5 w-6.5"
        >
          {next.swatches.map((c, i) => (
            <circle
              key={i}
              data-swatch={hex(c)}
              cx={7 + i * 12}
              cy={7}
              r={6}
              fill={hex(c)}
              stroke="#f8fafc"
              strokeOpacity={0.75}
              strokeWidth={1.2}
            />
          ))}
        </svg>
      </button>
      {said && (
        <div
          role="status"
          data-testid="shipwreck-livery-help"
          className={`${PANEL} pointer-events-none absolute z-10 w-64 px-3 py-2 text-left ${
            bubble === "left"
              ? "right-full top-0 mr-3"
              : "bottom-full left-1/2 mb-3 -translate-x-1/2"
          }`}
        >
          <p className="text-base font-semibold text-white">{said.title}</p>
          <p className="text-sm text-slate-300">{said.lines[0]}</p>
        </div>
      )}
    </div>
  );
}
