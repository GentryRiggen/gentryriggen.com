import PixelSprite from "../../start/PixelSprite";
import {
  STAR_COLORS,
  STAR_ROWS,
} from "@/lib/ever-onward/universes/higher/sprites";

interface StarIconProps {
  className?: string;
}

/** A pixel gold star, the Build It Higher prestige mark (drawn, never an emoji). */
export default function StarIcon({ className = "h-4" }: StarIconProps) {
  return (
    <PixelSprite rows={STAR_ROWS} palette={STAR_COLORS} className={className} />
  );
}
