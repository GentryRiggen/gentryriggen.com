"use client";

import { Check, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";
import {
  useShipBuilderStore,
  type PendingRemoval,
} from "@/lib/ship-builder/state/store";
import { buttonClass, dangerButtonClass, panelClass } from "./styles";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default function RemovalConfirm() {
  const pending = useShipBuilderStore((s) => s.pendingRemoval);
  if (!pending) return null;
  return <RemovalDialog pending={pending} />;
}

interface RemovalDialogProps {
  pending: PendingRemoval;
}

function RemovalDialog({ pending }: RemovalDialogProps) {
  const confirmRemoval = useShipBuilderStore((s) => s.confirmRemoval);
  const cancelRemoval = useShipBuilderStore((s) => s.cancelRemoval);
  const keepRef = useRef<HTMLButtonElement>(null);

  // Take focus for the dialog's lifetime, then hand it back to whatever had it.
  useEffect(() => {
    const previous = document.activeElement;
    keepRef.current?.focus();
    return () => {
      if (previous instanceof HTMLElement && document.contains(previous)) {
        previous.focus();
      }
    };
  }, []);

  const message =
    pending.kind === "part"
      ? `Removing this part also removes ${plural(pending.ids.length - 1, "attached part")}.`
      : `Shortening the hull removes ${plural(pending.ids.length, "part")}.`;

  return (
    <div
      role="alertdialog"
      aria-label="Confirm removal"
      className={`absolute left-1/2 top-40 z-30 max-w-[calc(100%-1.5rem)] lg:top-[7rem] flex -translate-x-1/2 items-center gap-3 rounded-lg border px-4 py-3 shadow-lg ${panelClass}`}
    >
      <p className="text-sm">{message}</p>
      <button
        type="button"
        onClick={confirmRemoval}
        className={dangerButtonClass}
      >
        <Trash2 aria-hidden="true" className="h-4 w-4 shrink-0" />
        Remove
      </button>
      <button
        ref={keepRef}
        type="button"
        onClick={cancelRemoval}
        className={buttonClass}
      >
        <Check aria-hidden="true" className="h-4 w-4 shrink-0" />
        Keep
      </button>
    </div>
  );
}
