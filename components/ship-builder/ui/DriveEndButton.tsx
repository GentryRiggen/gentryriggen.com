"use client";

import { LogOut } from "lucide-react";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { focusDriveButton } from "./DriveButton";
import { panelClass } from "./styles";

/** The way out of a drive, shown while sailing. */
export default function DriveEndButton() {
  const isSailing = useShipBuilderStore((s) => s.drive.status === "sailing");
  const endDrive = useShipBuilderStore((s) => s.endDrive);
  if (!isSailing) return null;

  function handleEnd() {
    endDrive();
    focusDriveButton();
  }

  return (
    <div className="pointer-events-none absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10">
      <button
        type="button"
        onClick={handleEnd}
        className={`pointer-events-auto inline-flex min-h-11 touch-manipulation items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold shadow-lg hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:hover:bg-slate-800 dark:focus-visible:outline-sky-400 ${panelClass}`}
      >
        <LogOut aria-hidden="true" className="h-4 w-4 shrink-0" />
        End drive
      </button>
    </div>
  );
}
