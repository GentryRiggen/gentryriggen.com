"use client";

import { LogOut } from "lucide-react";
import { useSyncExternalStore } from "react";
import { CELLS_PER_KNOT } from "@/lib/ship-builder/sail/handling";
import { getSailState, subscribeSail } from "@/lib/ship-builder/state/sailLive";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import useDriveKeys from "../hooks/useDriveKeys";
import { focusDriveButton } from "./DriveButton";
import DriveViewSwitch from "./DriveViewSwitch";
import SteeringWheel from "./SteeringWheel";
import ThrottleLever from "./ThrottleLever";
import { panelClass } from "./styles";

/** Whole knots, so the readout re-renders only when the number changes. */
function getKnots(): number {
  const sail = getSailState();
  return sail ? Math.round(Math.abs(sail.speed) / CELLS_PER_KNOT) : 0;
}

function SpeedReadout() {
  const knots = useSyncExternalStore(subscribeSail, getKnots, () => 0);
  return (
    <p
      aria-label={`Speed ${knots} knots`}
      className={`pointer-events-none rounded-full border px-3 py-1 text-sm font-semibold tabular-nums shadow-md ${panelClass}`}
    >
      {knots} kn
    </p>
  );
}

function EndDriveButton() {
  const endDrive = useShipBuilderStore((s) => s.endDrive);

  function handleEnd() {
    endDrive();
    focusDriveButton();
  }

  return (
    <button
      type="button"
      onClick={handleEnd}
      className={`pointer-events-auto inline-flex min-h-11 touch-manipulation items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold shadow-lg hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:hover:bg-slate-800 dark:focus-visible:outline-sky-400 ${panelClass}`}
    >
      <LogOut aria-hidden="true" className="h-4 w-4 shrink-0" />
      End drive
    </button>
  );
}

function SailingControls() {
  useDriveKeys();
  const kind = useShipBuilderStore((s) => s.ship.kind);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col items-start gap-2">
          <DriveViewSwitch />
          <SpeedReadout />
        </div>
        <EndDriveButton />
      </div>
      <div className="flex items-end justify-between">
        <SteeringWheel kind={kind} />
        <ThrottleLever kind={kind} />
      </div>
    </div>
  );
}

/** The drive controls: wheel, throttle, camera views, speed and the way out. */
export default function DriveHud() {
  const isSailing = useShipBuilderStore((s) => s.drive.status === "sailing");
  if (!isSailing) return null;
  return <SailingControls />;
}
