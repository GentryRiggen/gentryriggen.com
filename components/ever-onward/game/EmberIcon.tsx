import PixelSprite from "../start/PixelSprite";
import { EMBER_COLORS, EMBER_ROWS } from "@/lib/ever-onward/start/sprites";

interface EmberIconProps {
  className?: string;
}

/** A pixel flame; drawn, not an emoji, so it looks the same on every device. */
export default function EmberIcon({ className = "h-4" }: EmberIconProps) {
  return (
    <PixelSprite
      rows={EMBER_ROWS}
      palette={EMBER_COLORS}
      className={className}
    />
  );
}
