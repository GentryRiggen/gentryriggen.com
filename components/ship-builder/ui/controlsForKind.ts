import type { ShipKind } from "@/lib/ship-builder/model/kinds";

export type WheelVariant = "spoked" | "modern" | "compact" | "plain";

/** Style data for the steering wheel; class names are full Tailwind strings. */
export interface WheelStyle {
  variant: WheelVariant;
  /** Overall size of the wheel. */
  sizeClass: string;
  /** Stroke colour of the rim. */
  rimClass: string;
  /** Stroke colour of the spokes. */
  spokeClass: string;
  /** Fill colour of the hub. */
  hubClass: string;
  /** Backing disc behind the wheel, for contrast on any sea. */
  backingClass: string;
}

/** Style data for the throttle lever. */
export interface LeverStyle {
  /** The slot the lever slides in. */
  trackClass: string;
  /** The grip. */
  knobClass: string;
}

export interface ControlsStyle {
  wheelStyle: WheelStyle;
  leverStyle: LeverStyle;
  /** Spoken name of the helm, used for accessible labels. */
  label: string;
}

export const controlsForKind: Record<ShipKind, ControlsStyle> = {
  liner: {
    label: "Liner helm",
    wheelStyle: {
      variant: "spoked",
      sizeClass: "h-28 w-28 sm:h-36 sm:w-36",
      rimClass: "stroke-amber-800 dark:stroke-amber-600",
      spokeClass: "stroke-yellow-600 dark:stroke-yellow-500",
      hubClass: "fill-yellow-500 dark:fill-yellow-400",
      backingClass: "bg-amber-50/70 dark:bg-stone-900/70",
    },
    leverStyle: {
      trackClass: "bg-amber-900/70 dark:bg-amber-950/80",
      knobClass:
        "bg-yellow-500 border-yellow-700 dark:bg-yellow-400 dark:border-yellow-200",
    },
  },
  cruise: {
    label: "Cruise ship helm",
    wheelStyle: {
      variant: "modern",
      sizeClass: "h-28 w-28 sm:h-36 sm:w-36",
      rimClass: "stroke-sky-500 dark:stroke-sky-300",
      spokeClass: "stroke-sky-400 dark:stroke-sky-200",
      hubClass: "fill-sky-300 dark:fill-sky-200",
      backingClass: "bg-sky-100/60 backdrop-blur-sm dark:bg-sky-950/60",
    },
    leverStyle: {
      trackClass: "bg-sky-200/70 backdrop-blur-sm dark:bg-sky-950/70",
      knobClass:
        "bg-sky-300 border-sky-500 dark:bg-sky-200 dark:border-sky-400",
    },
  },
  navy: {
    label: "Naval helm",
    wheelStyle: {
      variant: "compact",
      sizeClass: "h-24 w-24 sm:h-28 sm:w-28",
      rimClass: "stroke-slate-600 dark:stroke-slate-300",
      spokeClass: "stroke-slate-500 dark:stroke-slate-400",
      hubClass: "fill-slate-700 dark:fill-slate-200",
      backingClass: "bg-slate-200/70 dark:bg-slate-800/70",
    },
    leverStyle: {
      trackClass: "bg-slate-400/70 dark:bg-slate-700/80",
      knobClass:
        "bg-slate-600 border-slate-800 dark:bg-slate-300 dark:border-slate-100",
    },
  },
  cargo: {
    label: "Cargo ship helm",
    wheelStyle: {
      variant: "plain",
      sizeClass: "h-32 w-32 sm:h-40 sm:w-40",
      rimClass: "stroke-zinc-800 dark:stroke-zinc-200",
      spokeClass: "stroke-zinc-700 dark:stroke-zinc-300",
      hubClass: "fill-zinc-800 dark:fill-zinc-200",
      backingClass: "bg-white/60 dark:bg-zinc-900/60",
    },
    leverStyle: {
      trackClass: "bg-zinc-300/80 dark:bg-zinc-800/80",
      knobClass:
        "bg-orange-500 border-orange-700 dark:bg-orange-400 dark:border-orange-200",
    },
  },
};
