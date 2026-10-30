import { cleanCaptionTitle, drawCaption } from "@/lib/share/caption";
import { canvasToPng } from "@/lib/share/shareImage";

export const PHOTO_SUBTITLE = "Made in Ship Builder";
export const PHOTO_TITLE_FALLBACK = "My ship";

/** Stamps the corner caption on a copy of the scene and encodes it as a PNG. */
export async function developPhoto(
  scene: HTMLCanvasElement,
  shipName: string
): Promise<Blob | null> {
  const picture = document.createElement("canvas");
  picture.width = scene.width;
  picture.height = scene.height;
  const ctx = picture.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(scene, 0, 0);
  drawCaption(
    ctx,
    picture.width,
    picture.height,
    cleanCaptionTitle(shipName, PHOTO_TITLE_FALLBACK),
    PHOTO_SUBTITLE
  );
  return canvasToPng(picture);
}
