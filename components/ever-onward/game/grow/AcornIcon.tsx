import PixelSprite from "../../start/PixelSprite";
import { ACORN_COLORS, ACORN_ROWS } from "@/lib/ever-onward/start/sprites";

interface AcornIconProps {
  className?: string;
}

/** A pixel acorn, the Make It Grow prestige mark (drawn, never an emoji). */
export default function AcornIcon({ className = "h-4" }: AcornIconProps) {
  return (
    <PixelSprite
      rows={ACORN_ROWS}
      palette={ACORN_COLORS}
      className={className}
    />
  );
}
