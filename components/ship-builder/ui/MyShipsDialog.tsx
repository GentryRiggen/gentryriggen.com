"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  deleteShip,
  listShips,
  renameShip,
  type SavedShip,
} from "@/lib/ship-builder/persist/local";
import { MAX_NAME_LENGTH } from "@/lib/ship-builder/model/placement";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import {
  buttonClass,
  dangerButtonClass,
  inputClass,
  panelClass,
} from "./styles";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

/** Wraps Tab / Shift+Tab focus between the first and last focusable child. */
function trapTab(container: HTMLElement, event: KeyboardEvent) {
  const focusable = Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  );
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;
  const isInside = active instanceof Node && container.contains(active);
  if (event.shiftKey && (active === first || !isInside)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || !isInside)) {
    event.preventDefault();
    first.focus();
  }
}

interface MyShipsDialogProps {
  onClose: () => void;
}

export default function MyShipsDialog({ onClose }: MyShipsDialogProps) {
  const [ships, setShips] = useState<SavedShip[]>(() => listShips());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const loadShip = useShipBuilderStore((s) => s.loadShip);
  const rename = useShipBuilderStore((s) => s.rename);
  const savedId = useShipBuilderStore((s) => s.savedId);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const handleDocumentKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "Escape") {
      // Escape inside the rename input cancels the rename, not the dialog.
      if (event.target instanceof HTMLInputElement) return;
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "Tab" && dialogRef.current) {
      trapTab(dialogRef.current, event);
    }
  });

  useEffect(() => {
    closeButtonRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      handleDocumentKeyDown(event);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function handleLoad(entry: SavedShip) {
    loadShip(entry.ship, entry.id);
    onClose();
  }

  function commitRename(entry: SavedShip) {
    const name = draftName.trim().slice(0, MAX_NAME_LENGTH) || entry.name;
    if (renameShip(entry.id, name)) {
      if (entry.id === savedId) rename(name);
      setShips(listShips());
    }
    setRenamingId(null);
  }

  function handleDelete(entry: SavedShip) {
    if (deleteShip(entry.id)) setShips(listShips());
    setConfirmingId(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="My Ships"
        className={`w-full max-w-md rounded-lg border p-4 shadow-xl ${panelClass}`}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">My Ships</h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className={buttonClass}
          >
            Close
          </button>
        </div>

        {ships.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            No saved ships yet. Use Save to keep a design here.
          </p>
        ) : (
          <ul className="max-h-96 space-y-2 overflow-y-auto">
            {ships.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 p-2 dark:border-slate-800"
              >
                {renamingId === entry.id ? (
                  <input
                    autoFocus
                    aria-label={`New name for ${entry.name}`}
                    value={draftName}
                    maxLength={MAX_NAME_LENGTH}
                    onChange={(event) => setDraftName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") commitRename(entry);
                      if (event.key === "Escape") {
                        event.stopPropagation();
                        setRenamingId(null);
                      }
                    }}
                    onBlur={() => commitRename(entry)}
                    className={`flex-1 ${inputClass}`}
                  />
                ) : (
                  <span className="flex-1 truncate text-sm font-medium">
                    {entry.name}
                  </span>
                )}
                <button
                  type="button"
                  aria-label={`Load ${entry.name}`}
                  onClick={() => handleLoad(entry)}
                  className={buttonClass}
                >
                  Load
                </button>
                <button
                  type="button"
                  aria-label={`Rename ${entry.name}`}
                  onClick={() => {
                    setRenamingId(entry.id);
                    setDraftName(entry.name);
                  }}
                  className={buttonClass}
                >
                  Rename
                </button>
                {confirmingId === entry.id ? (
                  <button
                    type="button"
                    aria-label={`Confirm delete ${entry.name}`}
                    onClick={() => handleDelete(entry)}
                    className={dangerButtonClass}
                  >
                    Confirm
                  </button>
                ) : (
                  <button
                    type="button"
                    aria-label={`Delete ${entry.name}`}
                    onClick={() => setConfirmingId(entry.id)}
                    className={buttonClass}
                  >
                    Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
