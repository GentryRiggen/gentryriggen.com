import PixelSprite from "../../start/PixelSprite";
import { STICKER_COLORS, STICKER_ROWS } from "./sprites";

interface StickerIconProps {
  className?: string;
}

/** A pixel smiley sticker, the Make Everyone Smile prestige mark. */
export default function StickerIcon({ className = "h-4" }: StickerIconProps) {
  return (
    <PixelSprite
      rows={STICKER_ROWS}
      palette={STICKER_COLORS}
      className={className}
    />
  );
}
