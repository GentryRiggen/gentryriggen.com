/** A screen rectangle in CSS pixels. */
export interface ScreenRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Where the orbit target should appear on the canvas, and how large. */
export interface CardFraming {
  /** Canvas pixels from the left. */
  x: number;
  /** Canvas pixels from the top. */
  y: number;
  /** How much smaller than usual the scene is drawn (1 is unchanged). */
  scale: number;
}

/**
 * The share of the canvas a wreck usually takes at the default zoom. A wreck
 * lies long and low, so a short strip above the card can still hold it.
 */
const WRECK_WIDTH_SHARE = 0.7;
const WRECK_HEIGHT_SHARE = 0.45;
/** Never shrink the scene below this, however little room the card leaves. */
export const MIN_CARD_SCALE = 0.3;
/** Breathing room between the wreck's space and the card or canvas edge. */
const GAP = 12;

/**
 * Fits the wreck into the largest clear part of the canvas beside the result
 * card (above it on a phone, or beside it on a wide screen), so the card does
 * not cover it. Returns null when there is no card or either rectangle is
 * empty.
 */
export function cardFraming(
  canvas: ScreenRect,
  card: ScreenRect | null
): CardFraming | null {
  if (!card || canvas.width <= 0 || canvas.height <= 0) return null;
  if (card.width <= 0 || card.height <= 0) return null;
  const cardLeft = card.left - canvas.left;
  const cardTop = card.top - canvas.top;
  const cardRight = cardLeft + card.width;
  const cardBottom = cardTop + card.height;
  const { width, height } = canvas;
  const regions: ScreenRect[] = [
    { left: 0, top: 0, width, height: cardTop - GAP },
    {
      left: 0,
      top: cardBottom + GAP,
      width,
      height: height - cardBottom - GAP,
    },
    { left: 0, top: 0, width: cardLeft - GAP, height },
    { left: cardRight + GAP, top: 0, width: width - cardRight - GAP, height },
  ];
  let best: { region: ScreenRect; scale: number } | null = null;
  for (const region of regions) {
    if (region.width <= 0 || region.height <= 0) continue;
    const scale = Math.min(
      1,
      region.width / (width * WRECK_WIDTH_SHARE),
      region.height / (height * WRECK_HEIGHT_SHARE)
    );
    if (!best || scale > best.scale) best = { region, scale };
  }
  if (!best) {
    return { x: width / 2, y: height / 2, scale: MIN_CARD_SCALE };
  }
  const { region, scale } = best;
  return {
    x: region.left + region.width / 2,
    y: region.top + region.height / 2,
    scale: Math.max(MIN_CARD_SCALE, scale),
  };
}
