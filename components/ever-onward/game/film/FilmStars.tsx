/** A fixed scatter of stars (the same every time), drifting slowly upward. */
const STARS = Array.from({ length: 70 }, (_, i) => {
  // A small deterministic hash so the sky never changes between renders.
  const a = Math.sin(i * 12.9898) * 43758.5453;
  const b = Math.sin(i * 78.233) * 12345.6789;
  const x = (a - Math.floor(a)) * 400;
  const y = (b - Math.floor(b)) * 330;
  const size = i % 9 === 0 ? 3 : i % 3 === 0 ? 2 : 1;
  const twinkle = ["lm-twinkle", "lm-twinkle-b", "lm-twinkle-c"][i % 3];
  return { x, y, size, twinkle };
});

export default function FilmStars() {
  return (
    <svg
      viewBox="0 0 400 300"
      aria-hidden="true"
      shapeRendering="crispEdges"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full bg-[radial-gradient(circle_at_50%_110%,#1e1b4b_0%,#02030a_70%)]"
    >
      <g className="eo-film-stars">
        {STARS.map((s, i) => (
          <rect
            key={i}
            x={s.x}
            y={s.y}
            width={s.size}
            height={s.size}
            fill={s.size === 3 ? "#fde68a" : "#e2e8f0"}
            className={s.twinkle}
          />
        ))}
      </g>
    </svg>
  );
}
