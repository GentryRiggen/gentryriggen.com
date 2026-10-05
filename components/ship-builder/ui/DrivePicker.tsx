"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  DENSITIES,
  OBSTACLE_KINDS,
  loadDrivePrefs,
  saveDrivePrefs,
  type DrivePrefs,
} from "@/lib/ship-builder/sail/driveConfig";
import type { Density } from "@/lib/ship-builder/sail/field";
import type { ObstacleKind } from "@/lib/ship-builder/sail/types";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { focusDriveButton } from "./DriveButton";
import { panelClass } from "./styles";

const KIND_LABEL: Record<ObstacleKind, string> = {
  iceberg: "Icebergs",
  rock: "Rocks",
  buoy: "Buoys",
  ship: "Other ships",
};

const DENSITY_LABEL: Record<Density, string> = {
  few: "Few",
  some: "Some",
  many: "Many",
};

const OPTION_CLASS =
  "inline-flex min-h-11 touch-manipulation items-center justify-center rounded-full border px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:focus-visible:outline-sky-400";

const PRESSED_CLASS =
  "border-sky-500 bg-sky-50 text-sky-800 dark:border-sky-400 dark:bg-sky-950 dark:text-sky-200";

const UNPRESSED_CLASS =
  "border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700";

function newSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

/**
 * The obstacle picker, shown before sailing. Zero obstacles is allowed (open
 * water). The choices are remembered per device, never saved with the ship.
 */
export default function DrivePicker() {
  const isOpen = useShipBuilderStore((s) => s.drive.status === "setup");
  if (!isOpen) return null;
  return <DrivePickerDialog />;
}

function DrivePickerDialog() {
  const startDrive = useShipBuilderStore((s) => s.startDrive);
  const endDrive = useShipBuilderStore((s) => s.endDrive);
  const [prefs, setPrefs] = useState<DrivePrefs>(loadDrivePrefs);
  const titleId = useId();
  const firstOption = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstOption.current?.focus();
  }, []);

  function toggleKind(kind: ObstacleKind) {
    setPrefs((current) => ({
      ...current,
      kinds: OBSTACLE_KINDS.filter((k) =>
        k === kind ? !current.kinds.includes(k) : current.kinds.includes(k)
      ),
    }));
  }

  function handleCancel() {
    endDrive();
    focusDriveButton();
  }

  function handleSetSail() {
    saveDrivePrefs(prefs);
    startDrive({ seed: newSeed(), kinds: prefs.kinds, density: prefs.density });
  }

  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center bg-slate-950/40 p-3 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.stopPropagation();
          handleCancel();
        }}
        className={`pointer-events-auto flex max-h-full w-full max-w-md flex-col gap-4 overflow-y-auto rounded-2xl border p-4 shadow-xl ${panelClass}`}
      >
        <h2 id={titleId} className="text-lg font-semibold">
          Set sail
        </h2>

        <div
          role="group"
          aria-label="Obstacles"
          className="flex flex-col gap-2"
        >
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            What is out there?
          </p>
          <div className="flex flex-wrap gap-2">
            {OBSTACLE_KINDS.map((kind, index) => {
              const isPressed = prefs.kinds.includes(kind);
              return (
                <button
                  key={kind}
                  ref={index === 0 ? firstOption : undefined}
                  type="button"
                  aria-pressed={isPressed}
                  onClick={() => toggleKind(kind)}
                  className={`${OPTION_CLASS} ${isPressed ? PRESSED_CLASS : UNPRESSED_CLASS}`}
                >
                  {KIND_LABEL[kind]}
                </button>
              );
            })}
          </div>
          {prefs.kinds.length === 0 && (
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Nothing picked: open water all the way.
            </p>
          )}
        </div>

        <div role="group" aria-label="How many" className="flex flex-col gap-2">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            How many?
          </p>
          <div className="flex gap-2">
            {DENSITIES.map((density) => {
              const isPressed = prefs.density === density;
              return (
                <button
                  key={density}
                  type="button"
                  aria-pressed={isPressed}
                  onClick={() => setPrefs((c) => ({ ...c, density }))}
                  className={`${OPTION_CLASS} flex-1 ${isPressed ? PRESSED_CLASS : UNPRESSED_CLASS}`}
                >
                  {DENSITY_LABEL[density]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleCancel}
            className="inline-flex min-h-11 touch-manipulation items-center justify-center rounded-full bg-slate-100 px-5 text-sm font-medium text-slate-800 hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 dark:focus-visible:outline-sky-400"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSetSail}
            className="inline-flex min-h-11 touch-manipulation items-center justify-center rounded-full bg-sky-600 px-5 text-sm font-semibold text-white hover:bg-sky-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:bg-sky-500 dark:hover:bg-sky-400 dark:focus-visible:outline-sky-300"
          >
            Set sail
          </button>
        </div>
      </div>
    </div>
  );
}
