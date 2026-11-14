import { spriteRects, type Palette } from "@/lib/ever-onward/start/sprites";

interface PixelSpriteProps {
  rows: readonly string[];
  palette: Palette;
  className?: string;
}

/** A small decorative sprite in its own SVG (one unit per pixel). */
export default function PixelSprite({
  rows,
  palette,
  className = "",
}: PixelSpriteProps) {
  const width = Math.max(...rows.map((row) => row.length));
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${width} ${rows.length}`}
      shapeRendering="crispEdges"
      className={className}
    >
      {spriteRects(rows, palette).map((r) => (
        <rect
          key={`${r.x}-${r.y}`}
          x={r.x}
          y={r.y}
          width={r.w}
          height={r.h}
          fill={r.fill}
        />
      ))}
    </svg>
  );
}
