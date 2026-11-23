"use client";

import { useEffect, useState } from "react";
import { liveryHelp, type Help } from "@/lib/shipwreck/help";
import {
  funLiveries,
  realLiveries,
  resolveLivery,
  type Livery,
  type LiveryLook,
  type ShipSpec,
} from "@/lib/shipwreck/ships/types";
import Icon from "./Icon";
import { FOCUS, PANEL, ROUND, ROUND_ON } from "./styles";

/** How long the words under a tap stay up (ms). */
export const LIVERY_HELP_MS = 4500;

const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;

interface LiveryButtonProps {
  spec: ShipSpec;
  /** Her livery now (null: her default). */
  livery: string | null;
  /** A paint tapped: paint her in `id`. */
  onChange: (id: string) => void;
  /** Where the tray opens: beside the button (the HUD's rail) or above it. */
  bubble?: "left" | "above";
}

/**
 * A little ship in a paint (SVG fills: the colours are data): her hull,
 * white houses, a funnel with its top. A hospital ship's band, a dazzle's
 * stripes.
 */
export function PaintChip({
  look,
  className,
}: {
  look: LiveryLook;
  className?: string;
}) {
  const hull = hex(look.hull);
  return (
    <svg viewBox="0 0 48 30" aria-hidden="true" className={className}>
      <rect
        data-funnel={hex(look.funnel)}
        x={19}
        y={3}
        width={8}
        height={12}
        fill={hex(look.funnel)}
      />
      <rect x={19} y={3} width={8} height={3} fill={hex(look.top)} />
      <rect x={9} y={13} width={30} height={5} fill="#e8e4d8" />
      <path
        data-hull={hull}
        d="M2 18h44l-5 9H7z"
        fill={hull}
        stroke="#f8fafc"
        strokeOpacity={0.35}
        strokeWidth={0.8}
      />
      {look.band !== undefined && (
        <rect x={4} y={20} width={40} height={2.5} fill={hex(look.band)} />
      )}
      {look.dazzle && (
        <path
          d="M8 18l6 9M18 18l-4 9M24 18l7 9M34 18l-5 9M40 18l3 6"
          stroke="#e6e7e3"
          strokeWidth={2.2}
        />
      )}
    </svg>
  );
}

/**
 * The paint brush (1.7): a tap opens her paint tray, her real paints
 * (the anchor row) above paints just for fun (the sparkle row). Each paint
 * is a little ship in its colours; a tap paints her, live (the run goes
 * on), and says what that paint is. The tray stays open to compare; the
 * brush or the cross closes it. Not there for a ship with one paint.
 */
export default function LiveryButton({
  spec,
  livery,
  onChange,
  bubble = "left",
}: LiveryButtonProps) {
  const [open, setOpen] = useState(false);
  const [said, setSaid] = useState<Help | null>(null);
  useEffect(() => {
    if (!said) return;
    const id = setTimeout(() => setSaid(null), LIVERY_HELP_MS);
    return () => clearTimeout(id);
  }, [said]);
  const now = resolveLivery(spec, livery);
  if (now === null) return null;
  const current = spec.liveries?.find((l) => l.id === now);
  const real = realLiveries(spec);
  const fun = funLiveries(spec);

  const pick = (l: Livery) => {
    onChange(l.id);
    setSaid(liveryHelp(spec, l.id));
  };

  const row = (kind: "real" | "fun", list: readonly Livery[]) =>
    list.length > 0 && (
      <div data-testid={`shipwreck-paint-${kind}`} className="flex gap-2">
        <div className="flex w-10 shrink-0 flex-col items-center pt-2 text-slate-300">
          <Icon
            name={kind === "real" ? "anchor" : "sparkle"}
            className="size-6"
          />
          <span className="text-xs font-semibold">
            {kind === "real" ? "Real" : "Fun"}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {list.map((l) => {
            const on = l.id === now;
            return (
              <button
                key={l.id}
                type="button"
                aria-label={`Paint: ${l.label}`}
                aria-pressed={on}
                data-testid="shipwreck-paint"
                data-livery={l.id}
                onClick={() => pick(l)}
                className={`grid size-14 touch-manipulation place-items-center rounded-xl border-2 bg-sky-950/60 active:scale-95 ${FOCUS} ${
                  on ? "border-sky-300 bg-sky-800/70" : "border-white/10"
                }`}
              >
                <PaintChip look={l.look} className="h-9 w-12" />
              </button>
            );
          })}
        </div>
      </div>
    );

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={open ? "Close the paints" : "Paint: change her colours"}
        aria-expanded={open}
        data-testid="shipwreck-livery"
        data-current={now}
        onClick={() => setOpen((o) => !o)}
        className={`${open ? ROUND_ON : ROUND} relative`}
      >
        <Icon name="brush" className="size-8" />
        {current && (
          <PaintChip
            look={current.look}
            className="absolute bottom-0.5 right-0 h-4 w-6"
          />
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Her paints"
          data-testid="shipwreck-paint-tray"
          className={`${PANEL} pointer-events-auto absolute z-20 flex w-[19rem] max-w-[calc(100vw-6rem)] flex-col gap-3 p-3 text-left ${
            bubble === "left"
              ? "right-full top-0 mr-3"
              : "bottom-full left-1/2 mb-3 -translate-x-1/2"
          }`}
        >
          <button
            type="button"
            aria-label="Close the paints"
            data-testid="shipwreck-paint-close"
            onClick={() => setOpen(false)}
            className={`absolute right-2 top-2 grid size-10 touch-manipulation place-items-center rounded-full text-slate-300 active:scale-95 ${FOCUS}`}
          >
            <Icon name="close" className="size-5" />
          </button>
          {row("real", real)}
          {row("fun", fun)}
          {said && (
            <div role="status" data-testid="shipwreck-livery-help">
              <p className="text-base font-semibold text-white">{said.title}</p>
              <p className="text-sm text-slate-300">{said.lines[0]}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
