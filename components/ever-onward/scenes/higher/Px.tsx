interface PxProps {
  x: number;
  y: number;
  w: number;
  h: number;
  c: string;
  /** Fill opacity, 1 when omitted. */
  o?: number;
}

/** One crisp pixel-art rectangle, the building block of every picture here. */
export default function Px({ x, y, w, h, c, o }: PxProps) {
  return <rect x={x} y={y} width={w} height={h} fill={c} fillOpacity={o} />;
}

/** A little standing person made of rectangles (never more than a few pixels). */
export function Person({
  x,
  y,
  body,
  head = "#f3c9a0",
}: {
  x: number;
  y: number;
  body: string;
  head?: string;
}) {
  return (
    <g>
      <Px x={x} y={y + 4} w={5} h={6} c={body} />
      <Px x={x + 1} y={y} w={3} h={4} c={head} />
    </g>
  );
}

/** A small bird seen from the side, wings beating. */
export function Bird({
  x,
  y,
  c = "#3b3b4a",
}: {
  x: number;
  y: number;
  c?: string;
}) {
  return (
    <g>
      <Px x={x} y={y} w={5} h={2} c={c} />
      <g className="bh-flap">
        <Px x={x + 1} y={y - 2} w={3} h={2} c={c} />
      </g>
    </g>
  );
}
