export const PAINT_COLORS = [
  { id: "buff", name: "Buff", hex: "#d9b97c" },
  { id: "black", name: "Black", hex: "#222222" },
  { id: "white", name: "White", hex: "#f4f4f0" },
  { id: "red", name: "Red", hex: "#c8312b" },
  { id: "navy", name: "Navy", hex: "#1f3a6b" },
  { id: "sky", name: "Sky", hex: "#5aa9e0" },
  { id: "green", name: "Green", hex: "#3c8d4a" },
  { id: "yellow", name: "Yellow", hex: "#f2c744" },
  { id: "orange", name: "Orange", hex: "#ee8a2c" },
  { id: "pink", name: "Pink", hex: "#ec7fb0" },
  { id: "purple", name: "Purple", hex: "#7b4bb0" },
  { id: "grey", name: "Grey", hex: "#8a8f98" },
  { id: "oak", name: "Oak", hex: "#9a6b3f" },
  { id: "dark-oak", name: "Dark oak", hex: "#5a3a22" },
  { id: "weathered", name: "Weathered", hex: "#8b8479" },
] as const;

export type PaintColor = (typeof PAINT_COLORS)[number]["id"];

export const PAINT_COLOR_IDS = PAINT_COLORS.map(
  (c) => c.id
) as unknown as readonly [PaintColor, ...PaintColor[]];

export type HullArea = "topsides" | "bottom";

export function paintHex(color: PaintColor): string {
  const found = PAINT_COLORS.find((c) => c.id === color);
  return found ? found.hex : PAINT_COLORS[0].hex;
}

/** Pleasant container colours; the loud and the dull ones are left out. */
const CONTAINER_COLORS: readonly PaintColor[] = [
  "red",
  "navy",
  "sky",
  "green",
  "yellow",
  "orange",
  "grey",
  "buff",
];

/** FNV-1a over UTF-16 units: small, stable and well spread for short ids. */
function hashString(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * A container's colour: its own paint if it has any, else one picked from the
 * part id so the same container always looks the same and stacks vary.
 */
export function containerColor(id: string, painted?: PaintColor): PaintColor {
  return painted ?? CONTAINER_COLORS[hashString(id) % CONTAINER_COLORS.length];
}
