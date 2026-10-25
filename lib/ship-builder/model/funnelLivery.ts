import type { PaintColor } from "./paint";
import type { PartType, Ship } from "./types";

/** The funnel parts: the ones with a livery (colours and a mark). */
export const FUNNEL_TYPES = [
  "funnel",
  "funnel-large",
  "funnel-modern",
] as const;
export type FunnelType = (typeof FUNNEL_TYPES)[number];

export function isFunnelType(type: PartType): type is FunnelType {
  return (FUNNEL_TYPES as readonly string[]).includes(type);
}

/** The painted areas of a funnel: its body, the bands round it, its top. */
export const FUNNEL_AREAS = ["body", "bands", "top"] as const;
export type FunnelArea = (typeof FUNNEL_AREAS)[number];
export type FunnelPaint = Partial<Record<FunnelArea, PaintColor>>;

export const FUNNEL_LOGOS = [
  { id: "star", name: "Star" },
  { id: "anchor", name: "Anchor" },
  { id: "heart", name: "Heart" },
  { id: "wave", name: "Wave" },
  { id: "crown", name: "Crown" },
  { id: "compass", name: "Compass" },
  { id: "sun", name: "Sun" },
] as const;
export type FunnelLogo = (typeof FUNNEL_LOGOS)[number]["id"];

/** The logo ids as the non-empty tuple `z.enum` needs. */
export const FUNNEL_LOGO_IDS = FUNNEL_LOGOS.map(
  (logo) => logo.id
) as unknown as readonly [FunnelLogo, ...FunnelLogo[]];

/** What's painted on a funnel's side: one or two letters, or a logo. */
export type FunnelMark =
  | { kind: "letters"; text: string; color: PaintColor }
  | { kind: "logo"; logo: FunnelLogo; color: PaintColor };

export const MARK_TEXT_PATTERN = /^[A-Z0-9]{1,2}$/;

/** Uppercases, drops anything outside A–Z/0–9, keeps the first two. */
export function normalizeMarkText(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 2);
}

/** A funnel's colours: body is its own `color` override, else the ship's. */
export function funnelColors(
  ship: Ship,
  part: { color?: PaintColor }
): FunnelPaint {
  const merged: FunnelPaint = {
    ...ship.funnelPaint,
    ...(part.color ? { body: part.color } : {}),
  };
  const colors: FunnelPaint = {};
  for (const area of FUNNEL_AREAS) {
    const color = merged[area];
    if (color !== undefined) colors[area] = color;
  }
  return colors;
}
