"use client";

import { Flag, LogOut } from "lucide-react";
import { useSyncExternalStore } from "react";
import { SMOOTH_FINISH_CELLS } from "@/lib/ship-builder/challenges/definitions";
import {
  getSmoothRun,
  subscribeSmooth,
} from "@/lib/ship-builder/state/smoothLive";
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

function getReach(): number {
  return Math.floor(getSmoothRun().reach);
}

/** Smooth sailing: how far she has got toward the finish line. */
function ReachReadout() {
  const reach = useSyncExternalStore(subscribeSmooth, getReach, () => 0);
  return (
    <p
      aria-label={`Sailed ${reach} of ${SMOOTH_FINISH_CELLS} cells`}
      className={`pointer-events-none inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold tabular-nums shadow-md ${panelClass}`}
    >
      <Flag aria-hidden="true" className="h-4 w-4 shrink-0" />
      {reach} / {SMOOTH_FINISH_CELLS}
    </p>
  );
}

function EndDriveButton() {
  const endDrive = useShipBuilderStore((s) => s.endDrive);
  const finishSail = useShipBuilderStore((s) => s.finishSail);
  const isChallenge = useShipBuilderStore(
    (s) =>
      s.drive.status === "sailing" && s.drive.config.challenge !== undefined
  );

  function handleEnd() {
    // A challenge sail keeps what she has sailed and shows its card.
    if (isChallenge) finishSail(getSmoothRun());
    else endDrive();
    focusDriveButton();
  }

  return (
    <button
      type="button"
      onClick={handleEnd}
      className={`pointer-events-auto inline-flex min-h-11 touch-manipulation items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold shadow-lg hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:hover:bg-slate-800 dark:focus-visible:outline-sky-400 ${panelClass}`}
    >
      <LogOut aria-hidden="true" className="h-4 w-4 shrink-0" />
      {isChallenge ? "Stop sailing" : "End drive"}
    </button>
  );
}

function SailingControls() {
  useDriveKeys();
  const kind = useShipBuilderStore((s) => s.ship.kind);
  const isChallenge = useShipBuilderStore(
    (s) =>
      s.drive.status === "sailing" && s.drive.config.challenge !== undefined
  );
  const isBridge = useShipBuilderStore(
    (s) => s.drive.status === "sailing" && s.drive.view === "bridge"
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col items-start gap-2">
          <DriveViewSwitch />
          {!isBridge && <SpeedReadout />}
          {isChallenge && <ReachReadout />}
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
