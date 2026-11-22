/** Simple line icons (24×24, currentColor) for the Shipwreck HUD. */

export type IconName =
  | "back"
  | "clock"
  | "iceberg"
  | "torpedo"
  | "porthole"
  | "play"
  | "pause"
  | "help"
  | "xray"
  | "pin"
  | "orbit"
  | "bridge"
  | "stern"
  | "lifeboat"
  | "underwater"
  | "cinematic"
  | "walk"
  | "on-deck"
  | "look-under"
  | "drag-look"
  | "slide"
  | "rocket"
  | "boat"
  | "lights"
  | "break"
  | "sinks"
  | "afloat"
  | "close"
  | "replay"
  | "wreck"
  | "go"
  | "hull"
  | "camera"
  | "sound"
  | "mute";

const PATHS: Record<IconName, string> = {
  back: "M15 5l-7 7 7 7",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3.5 2",
  iceberg:
    "M2 15h20M5 15l4-9 3 4 2-3 5 8M4 18c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 4 0",
  torpedo:
    "M5 9.5h10l3 2.5-3 2.5H5a2.5 2.5 0 0 1 0-5zM18 12h3M20 9.5v5M2 18c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 6 0",
  porthole:
    "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zM12 4v3.5M12 16.5V20M4 12h3.5M16.5 12H20",
  play: "M8 5v14l11-7z",
  pause: "M8 5v14M16 5v14",
  help: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01",
  xray: "M3 14l2 4h14l2-4zM6 14V9h12v5M9 9V6h6v3M8 16.5h8",
  pin: "M12 21s-6-5.7-6-11a6 6 0 0 1 12 0c0 5.3-6 11-6 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  orbit:
    "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM3 12c0-2.5 4-4.5 9-4.5s9 2 9 4.5-4 4.5-9 4.5c-2 0-3.8-.3-5.3-.8M7 18l-1.5-1.8L7.5 15",
  bridge: "M4 19h16M6 19v-6h12v6M8 13V9h8v4M10 9V6h4v3",
  stern: "M3 16h13l5-4V9H8L3 16zM8 9V6M12 9V6",
  lifeboat: "M3 13h18l-3 5H6zM12 13V5M12 5l5 5",
  underwater:
    "M3 7c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 6 0M7 14a1.5 1.5 0 1 0 0 .1M13 17a1 1 0 1 0 0 .1M17 12a2 2 0 1 0 0 .1",
  cinematic: "M3 7h12v10H3zM15 10.5l6-3.5v10l-6-3.5",
  walk: "M13 4.5a1.5 1.5 0 1 0 0 .1M9 21l2-6-2-2 1-5 3 2 3 1M11 15l3 2 1 4M10 8l-3 2",
  // A ship with an up arrow over her: back on her deck.
  "on-deck": "M3 15h18l-3 5H6zM7 15v-2.5h4V15M12 11V2.5M8.5 6L12 2.5 15.5 6",
  // An eye over a wave line, an arrow going down under it.
  "look-under":
    "M3 7c2.2-3 5.4-4.5 9-4.5S18.8 4 21 7c-2.2 3-5.4 4.5-9 4.5S5.2 10 3 7zM12 5.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6zM2 15c2 1.4 4 1.4 6 0s4-1.4 6 0 4 1.4 6 0M12 17.5v4.5M9.5 19.5L12 22l2.5-2.5",
  // A finger on the screen with arrows either side: drag to look.
  "drag-look":
    "M10 16.5V9a1.5 1.5 0 0 1 3 0v4h3.5a2 2 0 0 1 2 2v2.5a4 4 0 0 1-4 4H12a4 4 0 0 1-3-1.4l-2.8-3.3a1.4 1.4 0 0 1 2-2L10 16.5M2.5 4.5h5M4.5 2.5l-2 2 2 2M16.5 4.5h5M19.5 2.5l2 2-2 2",
  // Two arrows down the slope.
  slide: "M5 4l7 7 7-7M5 12l7 7 7-7",
  rocket: "M12 21v-7M12 3l2.5 5h-5zM6 9l2 2M18 9l-2 2M5 14h2M17 14h2",
  boat: "M3 14h18l-3 5H6zM8 14v-3M16 14v-3M7 11h10",
  lights: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z",
  break: "M3 15h7l2-3-2-3M21 15h-7l2-4-1-3M10 9V6M15 8V5",
  sinks: "M2 8h20M12 11v9M8 16l4 4 4-4",
  afloat:
    "M3 16c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 6 0M5 13h14l-2-4H7zM10 9V6h4v3",
  close: "M6 6l12 12M18 6L6 18",
  replay: "M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5",
  wreck: "M2 20h20M4 20l3-5h9l4 5M8 15v-3M13 15v-4",
  go: "M5 12h14M13 6l6 6-6 6",
  hull: "M2 10h20l-3 7H5zM6 10V7h12v3",
  sound: "M4 9v6h4l5 4V5L8 9zM16.5 9a4 4 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11",
  mute: "M4 9v6h4l5 4V5L8 9zM17 9.5l5 5M22 9.5l-5 5",
  camera: "M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
};

const FILLED: ReadonlySet<IconName> = new Set(["play"]);

interface IconProps {
  name: IconName;
  className?: string;
}

export default function Icon({ name, className = "size-7" }: IconProps) {
  const filled = FILLED.has(name);
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
