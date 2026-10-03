"use client";

import { useState } from "react";
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
        role="dialog"
        aria-modal="true"
        aria-label="My Ships"
        className={`w-full max-w-md rounded-lg border p-4 shadow-xl ${panelClass}`}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">My Ships</h2>
          <button type="button" onClick={onClose} className={buttonClass}>
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
                      if (event.key === "Escape") setRenamingId(null);
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
