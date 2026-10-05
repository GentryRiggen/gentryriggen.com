"use client";

import { LogOut } from "lucide-react";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import useDriveKeys from "../hooks/useDriveKeys";
import CockpitOverlay from "./CockpitOverlay";
import { focusDriveButton } from "./DriveButton";
import DriveViewSwitch from "./DriveViewSwitch";
import SteeringWheel from "./SteeringWheel";
import ThrottleLever from "./ThrottleLever";
import useKnots from "./useKnots";
import { panelClass } from "./styles";

function SpeedReadout() {
  const knots = useKnots();
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
  const isBridge = useShipBuilderStore(
    (s) => s.drive.status === "sailing" && s.drive.view === "bridge"
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col items-start gap-2">
          <DriveViewSwitch />
          {!isBridge && <SpeedReadout />}
        </div>
        <EndDriveButton />
      </div>
      {isBridge ? (
        <CockpitOverlay kind={kind} />
      ) : (
        <div className="flex items-end justify-between">
          <SteeringWheel kind={kind} />
          <ThrottleLever kind={kind} />
        </div>
      )}
    </div>
  );
}

/** The drive controls: wheel, throttle, camera views, speed and the way out. */
export default function DriveHud() {
  const isSailing = useShipBuilderStore((s) => s.drive.status === "sailing");
  if (!isSailing) return null;
  return <SailingControls />;
}
