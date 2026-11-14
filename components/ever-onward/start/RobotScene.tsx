import type { Season } from "@/lib/ever-onward/season";
import type { SkyPhase } from "@/lib/ever-onward/sky";
import {
  EYE_COLOR,
  LANTERN_CENTER,
  ROBOT_COLORS,
  ROBOT_EYES,
  ROBOT_ROWS,
  spriteRects,
} from "@/lib/ever-onward/start/sprites";

/** Pixels in the scene's coordinates per robot pixel. */
const SCALE = 3;
const ROBOT_ORIGIN = { x: 38, y: 34 } as const;
const LANTERN = {
  x: ROBOT_ORIGIN.x + LANTERN_CENTER.x * SCALE,
  y: ROBOT_ORIGIN.y + LANTERN_CENTER.y * SCALE,
};

interface RobotSceneProps {
  season: Season;
  /** The lantern burns brightest at night and fades in daylight. */
  phase?: SkyPhase;
}

/**
 * The robot, its lantern, the sweeping beam and a tiny floating island, in
 * one SVG. The season picks the lantern color and what the robot wears.
 */
const LIGHT_STRENGTH: Record<SkyPhase, string> = {
  night: "opacity-100",
  dawn: "opacity-75",
  dusk: "opacity-85",
  day: "opacity-40",
};

export default function RobotScene({
  season,
  phase = "night",
}: RobotSceneProps) {
  const light = `transition-opacity duration-[2000ms] ${LIGHT_STRENGTH[phase]}`;
  const palette = { ...ROBOT_COLORS, L: season.lantern };
  const body = spriteRects(ROBOT_ROWS, palette);
  return (
    <svg
      role="img"
      aria-label={`A little robot holding a glowing lantern (${season.label} look)`}
      data-testid="eo-robot"
      data-season={season.id}
      viewBox="16 14 124 90"
      shapeRendering="crispEdges"
      className="mx-auto w-full max-w-sm sm:max-w-md overflow-visible"
    >
      <defs>
        <linearGradient id="eo-beam-fill" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={season.beam} stopOpacity="0.6" />
          <stop offset="1" stopColor={season.beam} stopOpacity="0" />
        </linearGradient>
        <radialGradient id="eo-glow-fill">
          <stop offset="0" stopColor={season.lantern} stopOpacity="0.9" />
          <stop offset="1" stopColor={season.lantern} stopOpacity="0" />
        </radialGradient>
      </defs>

      <g transform={`translate(${LANTERN.x} ${LANTERN.y})`}>
        <g className={light}>
          <g className="eo-sweep">
            {/* The invisible mirror keeps the group's centre on the lantern. */}
            <rect x="-220" y="-40" width="220" height="80" fill="none" />
            <polygon points="0,0 220,-40 220,40" fill="url(#eo-beam-fill)" />
          </g>
        </g>
      </g>

      {/* The island */}
      <rect x="22" y="88" width="116" height="3" fill="#334155" />
      <rect x="30" y="91" width="100" height="3" fill="#1e293b" />
      <rect x="44" y="94" width="72" height="3" fill="#172033" />
      <rect x="62" y="97" width="36" height="3" fill="#0f172a" />
      <rect x="22" y="87" width="8" height="1" fill="#4ade80" opacity="0.7" />
      <rect x="40" y="87" width="5" height="1" fill="#4ade80" opacity="0.7" />
      <rect x="112" y="87" width="9" height="1" fill="#4ade80" opacity="0.7" />

      <g className="eo-bob">
        <g
          transform={`translate(${ROBOT_ORIGIN.x} ${ROBOT_ORIGIN.y}) scale(${SCALE})`}
        >
          {body.map((r) => (
            <rect
              key={`${r.x}-${r.y}-${r.w}`}
              x={r.x}
              y={r.y}
              width={r.w}
              height={r.h}
              fill={r.fill}
            />
          ))}
          <g className="eo-blink">
            {ROBOT_EYES.map((eye) => (
              <rect
                key={eye.x}
                x={eye.x}
                y={eye.y}
                width={eye.w}
                height={eye.h}
                fill={EYE_COLOR}
              />
            ))}
          </g>
          {season.accessories.flatMap((accessory, index) =>
            spriteRects(
              accessory.rows,
              accessory.colors,
              accessory.x,
              accessory.y
            ).map((r) => (
              <rect
                key={`${index}-${r.x}-${r.y}-${r.w}`}
                x={r.x}
                y={r.y}
                width={r.w}
                height={r.h}
                fill={r.fill}
              />
            ))
          )}
        </g>
        <g className={light}>
          <circle
            className="eo-glow"
            cx={LANTERN.x}
            cy={LANTERN.y}
            r="24"
            fill="url(#eo-glow-fill)"
          />
        </g>
      </g>
    </svg>
  );
}
