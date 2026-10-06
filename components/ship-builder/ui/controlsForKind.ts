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
  /** The grip's colours. */
  knobClass: string;
  /** The grip's size and shape. */
  knobShapeClass: string;
}

/** Style data for the bridge cockpit overlay (bridge view only). */
export interface CockpitStyle {
  /** The console strip along the bottom of the screen. */
  consoleClass: string;
  /** The knots readout plate. */
  readoutClass: string;
  /** The gauge's ring, ticks and needle share this stroke colour. */
  gaugeClass: string;
  /** The gauge's needle. */
  needleClass: string;
  /** Caption under the gauge. */
  instrumentName: string;
  /** The caption's colour, legible on this console in light and dark. */
  captionClass: string;
  /** Wheel size in the cockpit, larger than the HUD wheel. */
  wheelSizeClass: string;
}

export interface ControlsStyle {
  wheelStyle: WheelStyle;
  leverStyle: LeverStyle;
  cockpit: CockpitStyle;
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
      knobShapeClass: "h-9 w-12 rounded-full",
      knobClass:
        "bg-yellow-500 border-yellow-700 dark:bg-yellow-400 dark:border-yellow-200",
    },
    cockpit: {
      consoleClass:
        "border-t-4 border-yellow-600 bg-gradient-to-t from-amber-950/90 to-amber-900/80 dark:border-yellow-500 dark:from-stone-950/95 dark:to-amber-950/85",
      readoutClass:
        "border-yellow-600 bg-amber-100 text-amber-950 dark:border-yellow-500 dark:bg-amber-950 dark:text-yellow-300",
      gaugeClass: "stroke-yellow-600 dark:stroke-yellow-400",
      needleClass: "stroke-red-700 dark:stroke-red-400",
      instrumentName: "Brass telegraph",
      captionClass: "text-amber-100 dark:text-amber-200",
      wheelSizeClass: "h-32 w-32 sm:h-44 sm:w-44",
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
      knobShapeClass: "h-7 w-12 rounded-lg",
      knobClass:
        "bg-sky-300 border-sky-500 dark:bg-sky-200 dark:border-sky-400",
    },
    cockpit: {
      consoleClass:
        "border-t border-white/60 bg-sky-100/45 backdrop-blur-md dark:border-sky-200/30 dark:bg-sky-950/55",
      readoutClass:
        "border-sky-300 bg-white/70 text-sky-950 backdrop-blur-sm dark:border-sky-400/60 dark:bg-sky-950/70 dark:text-sky-100",
      gaugeClass: "stroke-sky-500 dark:stroke-sky-300",
      needleClass: "stroke-cyan-600 dark:stroke-cyan-300",
      instrumentName: "Glass console",
      captionClass: "text-sky-900 dark:text-sky-100",
      wheelSizeClass: "h-32 w-32 sm:h-44 sm:w-44",
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
      knobShapeClass: "h-11 w-8 rounded-full",
      knobClass:
        "bg-slate-600 border-slate-800 dark:bg-slate-300 dark:border-slate-100",
    },
    cockpit: {
      consoleClass:
        "border-t-2 border-slate-500 bg-slate-800/90 dark:border-slate-400 dark:bg-slate-950/90",
      readoutClass:
        "border-slate-500 bg-slate-900 text-emerald-300 dark:border-slate-400 dark:bg-black dark:text-emerald-300",
      gaugeClass: "stroke-slate-400 dark:stroke-slate-300",
      needleClass: "stroke-emerald-400 dark:stroke-emerald-300",
      instrumentName: "Tactical display",
      captionClass: "text-slate-200 dark:text-slate-300",
      wheelSizeClass: "h-24 w-24 sm:h-32 sm:w-32",
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
      knobShapeClass: "h-7 w-12 rounded-sm",
      knobClass:
        "bg-orange-500 border-orange-700 dark:bg-orange-400 dark:border-orange-200",
    },
    cockpit: {
      consoleClass:
        "border-t-8 border-dashed border-orange-500 bg-zinc-300/90 dark:border-orange-400 dark:bg-zinc-800/90",
      readoutClass:
        "border-zinc-700 bg-zinc-900 text-orange-300 dark:border-zinc-400 dark:bg-zinc-950 dark:text-orange-300",
      gaugeClass: "stroke-zinc-700 dark:stroke-zinc-300",
      needleClass: "stroke-orange-600 dark:stroke-orange-400",
      instrumentName: "Engine gauge",
      captionClass: "text-zinc-800 dark:text-zinc-200",
      wheelSizeClass: "h-36 w-36 sm:h-48 sm:w-48",
    },
  },
  pirate: {
    label: "Pirate helm",
    wheelStyle: {
      variant: "spoked",
      sizeClass: "h-28 w-28 sm:h-36 sm:w-36",
      rimClass: "stroke-amber-900 dark:stroke-amber-500",
      spokeClass: "stroke-amber-800 dark:stroke-amber-400",
      hubClass: "fill-amber-700 dark:fill-amber-300",
      backingClass: "bg-amber-100/70 dark:bg-stone-900/70",
    },
    leverStyle: {
      trackClass: "bg-amber-950/70 dark:bg-stone-950/80",
      knobShapeClass: "h-9 w-12 rounded-md",
      knobClass:
        "bg-amber-700 border-amber-900 dark:bg-amber-400 dark:border-amber-200",
    },
    cockpit: {
      consoleClass:
        "border-t-4 border-amber-800 bg-gradient-to-t from-stone-950/90 to-amber-950/80 dark:border-amber-600 dark:from-stone-950/95 dark:to-stone-900/85",
      readoutClass:
        "border-amber-700 bg-amber-100 text-amber-950 dark:border-amber-500 dark:bg-stone-950 dark:text-amber-200",
      gaugeClass: "stroke-amber-700 dark:stroke-amber-400",
      needleClass: "stroke-red-800 dark:stroke-red-400",
      instrumentName: "Sail trim",
      captionClass: "text-amber-100 dark:text-amber-200",
      wheelSizeClass: "h-32 w-32 sm:h-44 sm:w-44",
    },
  },
};
