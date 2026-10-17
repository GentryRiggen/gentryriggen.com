import { CanvasTexture, SRGBColorSpace } from "three";

const WIDTH = 512;
const HEIGHT = 128;
const MAX_FONT = 96;
const TEXT_PADDING = 32;

/** A label drawn once on a canvas, so no font has to be fetched. */
export function createLabelTexture(
  text: string,
  bg: string,
  fg: string
): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = fg;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold ${MAX_FONT}px sans-serif`;
    // Shrink long labels until they fit inside the board.
    const measured = ctx.measureText(text).width;
    const available = WIDTH - TEXT_PADDING * 2;
    const size =
      measured > available
        ? Math.floor((MAX_FONT * available) / measured)
        : MAX_FONT;
    ctx.font = `bold ${size}px sans-serif`;
    ctx.fillText(text, WIDTH / 2, HEIGHT / 2 + 6);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
