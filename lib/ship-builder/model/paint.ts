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
