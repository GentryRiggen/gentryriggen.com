import type { GlyphPalette } from "@/lib/ever-onward/engine/types";
import { spriteRects } from "@/lib/ever-onward/start/sprites";

interface GlyphProps {
  glyph: readonly string[];
  palette: GlyphPalette;
  className?: string;
}

/** An artifact's pixel art (12 x 12), drawn crisp at any size. */
export default function Glyph({ glyph, palette, className }: GlyphProps) {
  const width = glyph[0]?.length ?? 12;
  return (
    <svg
      viewBox={`0 0 ${width} ${glyph.length}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      className={className}
    >
      {spriteRects(glyph, palette).map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.fill} />
      ))}
    </svg>
  );
}
