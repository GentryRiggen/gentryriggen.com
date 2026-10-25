import { CanvasTexture, SRGBColorSpace } from "three";
import type { FunnelMark } from "@/lib/ship-builder/model/funnelLivery";
import { FUNNEL_LOGO_PATHS } from "@/lib/ship-builder/model/funnelLogoPaths";
import { paintHex } from "@/lib/ship-builder/model/paint";

const SIZE = 256;
const LOGO_SIZE = 200;
const LOGO_UNITS = 24;

/** Session-lived, never disposed, like the davit arms. */
const textureCache = new Map<string, CanvasTexture>();

function cacheKey(mark: FunnelMark): string {
  return mark.kind === "letters"
    ? `letters|${mark.text}|${mark.color}`
    : `logo|${mark.logo}|${mark.color}`;
}

/**
 * A transparent 256 x 256 texture of a funnel's mark in its paint colour.
 * Cached per mark. Null when there is no 2D canvas context (jsdom).
 */
export function getFunnelMarkTexture(mark: FunnelMark): CanvasTexture | null {
  const key = cacheKey(mark);
  const cached = textureCache.get(key);
  if (cached) return cached;
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.fillStyle = paintHex(mark.color);
  if (mark.kind === "letters") {
    // Fit within 80% of the width, whatever the letters.
    let fontSize = mark.text.length > 1 ? 130 : 190;
    context.font = `bold ${fontSize}px sans-serif`;
    const width = context.measureText(mark.text).width;
    const maxWidth = SIZE * 0.8;
    if (width > maxWidth) {
      fontSize = Math.floor((fontSize * maxWidth) / width);
      context.font = `bold ${fontSize}px sans-serif`;
    }
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(mark.text, SIZE / 2, SIZE / 2 + fontSize * 0.04);
  } else {
    const scale = LOGO_SIZE / LOGO_UNITS;
    const offset = (SIZE - LOGO_SIZE) / 2;
    context.translate(offset, offset);
    context.scale(scale, scale);
    context.fill(new Path2D(FUNNEL_LOGO_PATHS[mark.logo]));
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  textureCache.set(key, texture);
  return texture;
}
