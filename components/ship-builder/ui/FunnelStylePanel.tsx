"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  FUNNEL_AREAS,
  FUNNEL_LOGOS,
  normalizeMarkText,
  type FunnelArea,
  type FunnelLogo,
} from "@/lib/ship-builder/model/funnelLivery";
import { FUNNEL_LOGO_PATHS } from "@/lib/ship-builder/model/funnelLogoPaths";
import { PAINT_COLORS, type PaintColor } from "@/lib/ship-builder/model/paint";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { SWATCH_FILL } from "./PaintPanel";
import {
  buttonClass,
  inputClass,
  panelClass,
  pressedButtonClass,
} from "./styles";

interface FunnelStylePanelProps {
  partId: string;
  onClose: () => void;
}

type MarkMode = "none" | "letters" | "logo";

const AREA_NAMES: Record<FunnelArea, string> = {
  body: "Body",
  bands: "Bands",
  top: "Top",
};

const SWATCH_BASE =
  "h-11 w-11 shrink-0 touch-manipulation rounded-full border border-slate-400 dark:border-slate-500";
const SWATCH_SELECTED =
  "ring-2 ring-sky-500 ring-offset-2 ring-offset-white dark:ring-sky-400 dark:ring-offset-slate-900";

interface SwatchRowProps {
  label: string;
  current: PaintColor | null;
  onPick: (color: PaintColor | null) => void;
  /** Adds a "Default" swatch that picks null. */
  withDefault?: boolean;
}

function SwatchRow({ label, current, onPick, withDefault }: SwatchRowProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex items-center gap-2 overflow-x-auto p-1.5"
    >
      {withDefault && (
        <button
          type="button"
          aria-pressed={current === null}
          onClick={() => onPick(null)}
          className={`h-11 shrink-0 touch-manipulation rounded-full border border-slate-400 bg-white px-3 text-xs font-medium text-slate-700 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-200 ${
            current === null ? SWATCH_SELECTED : ""
          }`}
        >
          Default
        </button>
      )}
      {PAINT_COLORS.map(({ id, name }) => (
        <button
          key={id}
          type="button"
          aria-label={name}
          aria-pressed={current === id}
          onClick={() => onPick(id)}
          className={`${SWATCH_BASE} ${SWATCH_FILL[id]} ${
            current === id ? SWATCH_SELECTED : ""
          }`}
        />
      ))}
    </div>
  );
}

/**
 * Ship-wide funnel colours plus the selected funnel's mark. Closes itself when
 * the selection changes or a trial, drive or walk starts.
 */
export default function FunnelStylePanel({
  partId,
  onClose,
}: FunnelStylePanelProps) {
  const part = useShipBuilderStore((s) =>
    s.ship.parts.find((p) => p.id === partId)
  );
  const funnelPaint = useShipBuilderStore((s) => s.ship.funnelPaint);
  const selectedId = useShipBuilderStore((s) => s.selectedId);
  const busy = useShipBuilderStore(
    (s) =>
      s.trial.status !== "idle" ||
      s.drive.status !== "idle" ||
      s.walk.status !== "idle"
  );
  const paintFunnels = useShipBuilderStore((s) => s.paintFunnels);
  const setFunnelMark = useShipBuilderStore((s) => s.setFunnelMark);

  const mark = part?.mark;
  // Only what has no stored mark yet stays local; the rest comes from the mark.
  const [pendingMode, setPendingMode] = useState<MarkMode | null>(null);
  const [pendingColor, setPendingColor] = useState<PaintColor>("white");
  const mode: MarkMode = mark ? mark.kind : (pendingMode ?? "none");
  const text = mark?.kind === "letters" ? mark.text : "";
  const color: PaintColor = mark?.color ?? pendingColor;

  const shouldClose = selectedId !== partId || busy;
  useEffect(() => {
    if (shouldClose) onClose();
  }, [shouldClose, onClose]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (!part) return null;

  function chooseMode(next: MarkMode) {
    setPendingMode(next);
    if (next === "none") setFunnelMark(partId, null);
    else if (next === "letters") {
      if (mark?.kind === "letters") return;
      setFunnelMark(partId, text ? { kind: "letters", text, color } : null);
    } else if (mark?.kind === "logo") {
      return;
    } else {
      setFunnelMark(partId, null);
    }
  }

  function changeText(raw: string) {
    const next = normalizeMarkText(raw);
    setFunnelMark(partId, next ? { kind: "letters", text: next, color } : null);
  }

  function pickLogo(logo: FunnelLogo) {
    setFunnelMark(partId, { kind: "logo", logo, color });
  }

  function pickMarkColor(next: PaintColor | null) {
    if (!next) return;
    setPendingColor(next);
    if (mark?.kind === "letters") {
      setFunnelMark(partId, { kind: "letters", text: mark.text, color: next });
    } else if (mark?.kind === "logo") {
      setFunnelMark(partId, { kind: "logo", logo: mark.logo, color: next });
    }
  }

  const modern = part.type === "funnel-modern";
  const modes: { id: MarkMode; name: string }[] = [
    { id: "none", name: "None" },
    { id: "letters", name: "Letters" },
    { id: "logo", name: "Logo" },
  ];

  return (
    <div
      role="dialog"
      aria-label="Funnel style"
      className={`max-h-[60vh] w-full max-w-sm overflow-y-auto rounded-lg border p-3 shadow-lg ${panelClass}`}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Funnel style</h2>
        <button
          type="button"
          onClick={onClose}
          className={`${buttonClass} min-h-11`}
        >
          <X aria-hidden="true" className="h-4 w-4 shrink-0" />
          Close
        </button>
      </div>

      <section className="mt-2">
        <h3 className="text-sm font-medium">Colours for every funnel</h3>
        {FUNNEL_AREAS.map((area) => (
          <div key={area} className="mt-1">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {AREA_NAMES[area]}
            </p>
            {area === "bands" && modern ? (
              <p className="py-2 text-xs text-slate-600 dark:text-slate-300">
                Modern funnels have no bands
              </p>
            ) : null}
            <SwatchRow
              label={AREA_NAMES[area]}
              current={funnelPaint?.[area] ?? null}
              onPick={(c) => paintFunnels(area, c)}
              withDefault
            />
          </div>
        ))}
      </section>

      <section className="mt-3">
        <h3 className="text-sm font-medium">This funnel</h3>
        <div role="group" aria-label="Mark" className="mt-1 flex gap-2">
          {modes.map(({ id, name }) => (
            <button
              key={id}
              type="button"
              aria-pressed={mode === id}
              onClick={() => chooseMode(id)}
              className={`${mode === id ? pressedButtonClass : buttonClass} min-h-11 flex-1`}
            >
              {name}
            </button>
          ))}
        </div>

        {mode === "letters" && (
          <div className="mt-2 space-y-1">
            <label className="flex items-center gap-2 text-sm">
              Letters
              <input
                type="text"
                value={text}
                maxLength={2}
                autoCapitalize="characters"
                autoComplete="off"
                onChange={(e) => changeText(e.target.value)}
                className={`${inputClass} min-h-11 w-20`}
              />
            </label>
            <SwatchRow
              label="Letter colour"
              current={color}
              onPick={pickMarkColor}
            />
          </div>
        )}

        {mode === "logo" && (
          <div className="mt-2 space-y-1">
            <div className="grid grid-cols-4 gap-2">
              {FUNNEL_LOGOS.map(({ id, name }) => (
                <button
                  key={id}
                  type="button"
                  aria-label={name}
                  aria-pressed={mark?.kind === "logo" && mark.logo === id}
                  onClick={() => pickLogo(id)}
                  className={`${
                    mark?.kind === "logo" && mark.logo === id
                      ? pressedButtonClass
                      : buttonClass
                  } min-h-11`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="h-6 w-6 fill-current"
                  >
                    <path d={FUNNEL_LOGO_PATHS[id]} />
                  </svg>
                </button>
              ))}
            </div>
            <SwatchRow
              label="Logo colour"
              current={color}
              onPick={pickMarkColor}
            />
          </div>
        )}
      </section>
    </div>
  );
}
