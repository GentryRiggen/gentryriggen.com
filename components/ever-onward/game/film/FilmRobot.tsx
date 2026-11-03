import type { CutsceneFrame } from "@/lib/ever-onward/engine/types";
import {
  EYE_COLOR,
  LANTERN_CENTER,
  ROBOT_COLORS,
  ROBOT_EYES,
  ROBOT_HEIGHT,
  ROBOT_ROWS,
  ROBOT_WIDTH,
  spriteRects,
} from "@/lib/ever-onward/start/sprites";

/** The film's picture is 400 x 300, the same as every universe's scene. */
export const FILM_WIDTH = 400;
export const FILM_HEIGHT = 300;
const SCALE = 2.7;
const GROUND = 292;
const LANTERN_COLOR = "#fde68a";

const BODY = spriteRects(ROBOT_ROWS, { ...ROBOT_COLORS, L: LANTERN_COLOR });

interface FilmRobotProps {
  robot: NonNullable<CutsceneFrame["robot"]>;
  /** Restarts the animations when the shot changes. */
  shotKey: string;
}

/**
 * The little robot, acting in the foreground of an intro film. It is drawn
 * in the same 400 x 300 space as the scenes and stands on the bottom edge;
 * its move is a CSS animation (see `eo-film-*` in globals.css).
 */
export default function FilmRobot({ robot, shotKey }: FilmRobotProps) {
  const x = Math.min(92, Math.max(8, robot.x ?? 30));
  const centerX = (x / 100) * FILM_WIDTH;
  const width = ROBOT_WIDTH * SCALE;
  const height = ROBOT_HEIGHT * SCALE;
  const isLeft = robot.facing === "left";
  const lantern = {
    x: (isLeft ? ROBOT_WIDTH - LANTERN_CENTER.x : LANTERN_CENTER.x) * SCALE,
    y: LANTERN_CENTER.y * SCALE,
  };
  return (
    <svg
      key={shotKey}
      viewBox={`0 0 ${FILM_WIDTH} ${FILM_HEIGHT}`}
      aria-hidden="true"
      data-testid="eo-film-robot"
      data-move={robot.move}
      shapeRendering="crispEdges"
      overflow="visible"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      <defs>
        <radialGradient id="eo-film-glow">
          <stop offset="0" stopColor={LANTERN_COLOR} stopOpacity="0.85" />
          <stop offset="0.4" stopColor={LANTERN_COLOR} stopOpacity="0.25" />
          <stop offset="1" stopColor={LANTERN_COLOR} stopOpacity="0" />
        </radialGradient>
      </defs>
      <g transform={`translate(${centerX - width / 2} ${GROUND - height})`}>
        <g className={`eo-film-move eo-film-${robot.move}`}>
          <ellipse
            cx={width / 2}
            cy={height + 1}
            rx={width * 0.42}
            ry={3}
            fill="#000"
            opacity="0.45"
          />
          <g className="eo-film-glow">
            <circle
              cx={lantern.x}
              cy={lantern.y}
              r={34}
              fill="url(#eo-film-glow)"
            />
          </g>
          <g className="eo-film-step">
            <g
              transform={
                isLeft
                  ? `translate(${width} 0) scale(${-SCALE} ${SCALE})`
                  : `scale(${SCALE})`
              }
            >
              {BODY.map((r) => (
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
            </g>
          </g>
          {robot.emote && (
            <g
              className="eo-film-emote"
              transform={`translate(${width / 2} -10)`}
            >
              <rect
                x={-11}
                y={-20}
                width={22}
                height={20}
                fill="#0f172a"
                stroke="#fde68a"
                strokeWidth={2}
              />
              <rect x={-3} y={0} width={6} height={4} fill="#fde68a" />
              <text
                x={0}
                y={-5}
                textAnchor="middle"
                fontSize={15}
                fontFamily="monospace"
                fontWeight="bold"
                fill="#fde68a"
              >
                {robot.emote}
              </text>
            </g>
          )}
        </g>
      </g>
    </svg>
  );
}
