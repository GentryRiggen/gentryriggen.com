import { cleanCaptionTitle, drawCaption } from "@/lib/share/caption";
import { canvasToPng } from "@/lib/share/shareImage";

export const PHOTO_SUBTITLE = "Made in Ship Builder";
export const PHOTO_TITLE_FALLBACK = "My ship";

/**
 * Stamps the corner caption on the scene copy and encodes it as a PNG. The
 * copy is ours, so it is drawn on directly and its memory is let go after.
 */
export async function developPhoto(
  scene: HTMLCanvasElement,
  shipName: string
): Promise<Blob | null> {
  const ctx = scene.getContext("2d");
  if (!ctx) return null;
  drawCaption(
    ctx,
    scene.width,
    scene.height,
    cleanCaptionTitle(shipName, PHOTO_TITLE_FALLBACK),
    PHOTO_SUBTITLE
  );
  const blob = await canvasToPng(scene);
  scene.width = 0;
  scene.height = 0;
  return blob;
}
