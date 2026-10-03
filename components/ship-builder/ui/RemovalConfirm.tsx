"use client";

import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { buttonClass, dangerButtonClass, panelClass } from "./styles";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default function RemovalConfirm() {
  const pending = useShipBuilderStore((s) => s.pendingRemoval);
  const confirmRemoval = useShipBuilderStore((s) => s.confirmRemoval);
  const cancelRemoval = useShipBuilderStore((s) => s.cancelRemoval);
  if (!pending) return null;

  const message =
    pending.kind === "part"
      ? `Removing this part also removes ${plural(pending.ids.length - 1, "attached part")}.`
      : `Shortening the hull removes ${plural(pending.ids.length, "part")}.`;

  return (
    <div
      role="alertdialog"
      aria-label="Confirm removal"
      className={`absolute left-1/2 top-16 z-30 flex -translate-x-1/2 items-center gap-3 rounded-lg border px-4 py-3 shadow-lg ${panelClass}`}
    >
      <p className="text-sm">{message}</p>
      <button
        type="button"
        onClick={confirmRemoval}
        className={dangerButtonClass}
      >
        Remove
      </button>
      <button type="button" onClick={cancelRemoval} className={buttonClass}>
        Keep
      </button>
    </div>
  );
}
