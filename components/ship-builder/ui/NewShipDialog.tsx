"use client";

import { ArrowLeft, X } from "lucide-react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { SHIP_KINDS, type ShipKind } from "@/lib/ship-builder/model/kinds";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { TEMPLATES } from "@/lib/ship-builder/templates";
import ShipKindIcon from "./icons/ShipKindIcon";
import { buttonClass, panelClass } from "./styles";
import trapTab from "./trapTab";

const KIND_CARDS: Record<
  ShipKind,
  { name: string; era?: string; blurb: string }
> = {
  liner: {
    name: "Ocean liner",
    era: "1910s",
    blurb: "Four tall funnels and a long, low hull.",
  },
  cruise: {
    name: "Cruise ship",
    blurb: "A floating hotel stacked high with decks.",
  },
  navy: {
    name: "Navy ship",
    blurb: "Fast and grey, with a big gun turret.",
  },
  cargo: {
    name: "Cargo ship",
    blurb: "Colourful containers, with the bridge at the back.",
  },
  pirate: {
    name: "Pirate ship",
    blurb: "Masts, sails and cannons, with a Jolly Roger.",
  },
};

const CARD_CLASS =
  "flex h-full min-h-32 w-full touch-manipulation flex-col items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 p-2 text-center transition-colors hover:border-sky-500 hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-sky-400 dark:hover:bg-sky-950 dark:focus-visible:outline-sky-400";

/** An odd card out at the end of the two-column grid spans the full row. */
const LAST_CARD_CLASS = "[&:last-child:nth-child(odd)]:col-span-2";

const ICON_CLASS =
  "h-16 w-full max-w-40 shrink-0 rounded-md bg-sky-100 dark:bg-sky-100";

interface NewShipDialogProps {
  onClose: () => void;
}

export default function NewShipDialog({ onClose }: NewShipDialogProps) {
  const newShip = useShipBuilderStore((s) => s.newShip);
  const newShipFromTemplate = useShipBuilderStore((s) => s.newShipFromTemplate);
  const [kind, setKind] = useState<ShipKind | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleDocumentKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (kind) setKind(null);
      else onClose();
      return;
    }
    if (event.key === "Tab" && dialogRef.current) {
      trapTab(dialogRef.current, event);
    }
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      handleDocumentKeyDown(event);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Each step starts with focus on its first card.
  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>("[data-card]")?.focus();
  }, [kind]);

  function handleBlank(chosen: ShipKind) {
    newShip(chosen);
    onClose();
  }

  function handleTemplate(id: string) {
    newShipFromTemplate(id);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="New ship"
        className={`w-full max-w-xl rounded-lg border p-4 shadow-xl ${panelClass}`}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">
            {kind ? `New ${KIND_CARDS[kind].name.toLowerCase()}` : "New ship"}
          </h2>
          <div className="flex gap-2">
            {kind && (
              <button
                type="button"
                onClick={() => setKind(null)}
                className={buttonClass}
              >
                <ArrowLeft aria-hidden="true" className="h-4 w-4 shrink-0" />
                Back
              </button>
            )}
            <button type="button" onClick={onClose} className={buttonClass}>
              <X aria-hidden="true" className="h-4 w-4 shrink-0" />
              Cancel
            </button>
          </div>
        </div>
        {kind ? (
          <ul className="grid grid-cols-2 gap-3">
            <li className={LAST_CARD_CLASS}>
              <button
                type="button"
                data-card
                data-blank
                onClick={() => handleBlank(kind)}
                className={CARD_CLASS}
              >
                <ShipKindIcon kind={kind} className={ICON_CLASS} />
                <span className="text-sm font-semibold">Blank ship</span>
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  Start with an empty hull and build your own.
                </span>
              </button>
            </li>
            {TEMPLATES[kind].map((template) => (
              <li key={template.id} className={LAST_CARD_CLASS}>
                <button
                  type="button"
                  data-card
                  data-template={template.id}
                  onClick={() => handleTemplate(template.id)}
                  className={CARD_CLASS}
                >
                  <ShipKindIcon kind={kind} className={ICON_CLASS} />
                  <span className="text-sm font-semibold">
                    {template.name}
                    <span className="font-normal text-slate-600 dark:text-slate-400">
                      {" "}
                      ({template.year})
                    </span>
                  </span>
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    {template.blurb}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {SHIP_KINDS.map((shipKind) => {
              const { name, era, blurb } = KIND_CARDS[shipKind];
              return (
                <li key={shipKind} className={LAST_CARD_CLASS}>
                  <button
                    type="button"
                    data-card
                    data-kind={shipKind}
                    onClick={() => setKind(shipKind)}
                    className={CARD_CLASS}
                  >
                    <ShipKindIcon kind={shipKind} className={ICON_CLASS} />
                    <span className="text-sm font-semibold">
                      {name}
                      {era && (
                        <span className="font-normal text-slate-600 dark:text-slate-400">
                          {" "}
                          ({era})
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      {blurb}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
