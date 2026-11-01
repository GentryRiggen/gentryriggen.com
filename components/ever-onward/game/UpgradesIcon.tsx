import PixelSprite from "../start/PixelSprite";
import {
  UPGRADES_COLORS,
  UPGRADES_ROWS,
} from "@/lib/ever-onward/start/sprites";

interface UpgradesIconProps {
  className?: string;
}

/** A pixel up arrow on a step; drawn, so it looks the same everywhere. */
export default function UpgradesIcon({ className = "h-4" }: UpgradesIconProps) {
  return (
    <PixelSprite
      rows={UPGRADES_ROWS}
      palette={UPGRADES_COLORS}
      className={className}
    />
  );
}
