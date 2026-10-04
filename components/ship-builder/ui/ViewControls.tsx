"use client";

import {
  ArrowDownToLine,
  Box,
  CloudLightning,
  Eye,
  Sailboat,
  Waves,
  Wind,
  type LucideIcon,
} from "lucide-react";
import {
  useShipBuilderStore,
  type CameraView,
} from "@/lib/ship-builder/state/store";
import useSeaState from "../hooks/useSeaState";
import type { SeaState } from "../scene/seaState";

const CAMERA_VIEWS: {
  view: CameraView;
  label: string;
  ariaLabel: string;
  Icon: LucideIcon;
}[] = [
  { view: "side", label: "Side", ariaLabel: "Side view", Icon: Eye },
  { view: "top", label: "Top", ariaLabel: "Top view", Icon: ArrowDownToLine },
  {
    view: "three-quarter",
    label: "¾",
    ariaLabel: "Three-quarter view",
    Icon: Box,
  },
  { view: "below", label: "Below", ariaLabel: "Below view", Icon: Waves },
];

const SEA_STATES: {
  sea: SeaState;
  label: string;
  ariaLabel: string;
  Icon: LucideIcon;
}[] = [
  { sea: "calm", label: "Calm", ariaLabel: "Calm sea", Icon: Sailboat },
  { sea: "choppy", label: "Choppy", ariaLabel: "Choppy sea", Icon: Wind },
  {
    sea: "stormy",
    label: "Stormy",
    ariaLabel: "Stormy sea",
    Icon: CloudLightning,
  },
];

const GROUP_CLASS =
  "pointer-events-auto flex items-center gap-0.5 rounded-lg border border-slate-300 bg-white/90 p-0.5 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/90";
const SEGMENT_BASE =
  "inline-flex min-h-11 min-w-11 touch-manipulation items-center justify-center gap-1.5 rounded-md px-2.5 text-sm font-medium";
const SEGMENT_IDLE = `${SEGMENT_BASE} text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800`;
const SEGMENT_PRESSED = `${SEGMENT_BASE} bg-sky-100 text-sky-900 dark:bg-sky-900 dark:text-sky-100`;

/**
 * Camera and sea controls floating over the top of the 3D view. Below lg the
 * drawer toggles use the top row, so these sit on a second row beneath them.
 */
export default function ViewControls() {
  const { seaState, setSeaState } = useSeaState();
  const cameraView = useShipBuilderStore((s) => s.camera.view);
  const setCameraView = useShipBuilderStore((s) => s.setCameraView);

  return (
    <div className="pointer-events-none absolute inset-x-3 top-16 z-10 flex flex-wrap items-start justify-between gap-2 lg:top-3">
      <div role="group" aria-label="Camera" className={GROUP_CLASS}>
        {CAMERA_VIEWS.map(({ view, label, ariaLabel, Icon }) => (
          <button
            key={view}
            type="button"
            aria-label={ariaLabel}
            aria-pressed={cameraView === view}
            onClick={() => setCameraView(view)}
            className={cameraView === view ? SEGMENT_PRESSED : SEGMENT_IDLE}
          >
            <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span className="sr-only xl:not-sr-only">{label}</span>
          </button>
        ))}
      </div>
      <div role="group" aria-label="Sea" className={GROUP_CLASS}>
        {SEA_STATES.map(({ sea, label, ariaLabel, Icon }) => (
          <button
            key={sea}
            type="button"
            aria-label={ariaLabel}
            aria-pressed={seaState === sea}
            onClick={() => setSeaState(sea)}
            className={seaState === sea ? SEGMENT_PRESSED : SEGMENT_IDLE}
          >
            <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span className="sr-only xl:not-sr-only">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
