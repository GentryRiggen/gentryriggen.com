"use client";

import { X } from "lucide-react";
import { useEffect, useEffectEvent, useRef } from "react";
import { SHIP_KINDS, type ShipKind } from "@/lib/ship-builder/model/kinds";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
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
};

interface NewShipDialogProps {
  onClose: () => void;
}

export default function NewShipDialog({ onClose }: NewShipDialogProps) {
  const newShip = useShipBuilderStore((s) => s.newShip);
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstCardRef = useRef<HTMLButtonElement>(null);

  const handleDocumentKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "Tab" && dialogRef.current) {
      trapTab(dialogRef.current, event);
    }
  });

  useEffect(() => {
    firstCardRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      handleDocumentKeyDown(event);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function handleChoose(kind: ShipKind) {
    newShip(kind);
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
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">New ship</h2>
          <button type="button" onClick={onClose} className={buttonClass}>
            <X aria-hidden="true" className="h-4 w-4 shrink-0" />
            Cancel
          </button>
        </div>
        <ul className="grid grid-cols-2 gap-3">
          {SHIP_KINDS.map((kind, index) => {
            const { name, era, blurb } = KIND_CARDS[kind];
            return (
              <li key={kind}>
                <button
                  ref={index === 0 ? firstCardRef : undefined}
                  type="button"
                  data-kind={kind}
                  onClick={() => handleChoose(kind)}
                  className="flex h-full min-h-32 w-full touch-manipulation flex-col items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 p-2 text-center transition-colors hover:border-sky-500 hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-sky-400 dark:hover:bg-sky-950 dark:focus-visible:outline-sky-400"
                >
                  <ShipKindIcon
                    kind={kind}
                    className="h-16 w-full max-w-40 shrink-0 rounded-md bg-sky-100 dark:bg-sky-100"
                  />
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
      </div>
    </div>
  );
}
