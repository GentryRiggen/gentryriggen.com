"use client";

import type { DriveView } from "@/lib/ship-builder/sail/driveConfig";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { buttonClass, pressedButtonClass } from "./styles";

const VIEWS: readonly { view: DriveView; label: string }[] = [
  { view: "chase", label: "Chase" },
  { view: "top", label: "Top" },
  { view: "bridge", label: "Bridge" },
];

/** Picks the drive camera: behind the ship, from above, or from the bridge. */
export default function DriveViewSwitch() {
  const current = useShipBuilderStore((s) =>
    s.drive.status === "sailing" ? s.drive.view : null
  );
  const setDriveView = useShipBuilderStore((s) => s.setDriveView);

  return (
    <div role="group" aria-label="Camera view" className="flex gap-1.5">
      {VIEWS.map(({ view, label }) => (
        <button
          key={view}
          type="button"
          aria-pressed={current === view}
          onClick={() => setDriveView(view)}
          className={`pointer-events-auto min-h-11 min-w-11 shadow-md ${
            current === view ? pressedButtonClass : buttonClass
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
