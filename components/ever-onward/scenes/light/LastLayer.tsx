import type { LightSceneInfo } from "@/lib/ever-onward/universes/light";

const LIGHT_COUNT = 11;
const LIGHTS = Array.from({ length: LIGHT_COUNT }, (_, i) => ({
  x: 30 + i * 34,
  y: 120 + 45 * Math.sin(i * 2.1),
}));

/** The lamp, and where the boat starts and stops on the dark water. */
const LAMP = { x: 200, y: 166 };
const BOAT_START_X = 380;
const BOAT_END_X = 282;
const BOAT_LANE_Y = 262;
/** How far a boat that has lost the beam drifts down the water. */
const DRIFT_Y = 26;

/** "0:03, a calm night": the minute and weather of the very first ship. */
function firstShipNote(seconds: number, isStorm: boolean): string {
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  return `The first ship: ${clock}, ${isStorm ? "a stormy night" : "a calm night"}.`;
}

function Boat({ info }: { info: LightSceneInfo }) {
  const x = BOAT_START_X - info.boatProgress * (BOAT_START_X - BOAT_END_X);
  const y = BOAT_LANE_Y + (1 - info.boatHeading) * DRIFT_Y;
  const isTrue = info.boatHeading >= 0.8;
  return (
    <g>
      {/* the old beam reaching for the boat: bright when it is true */}
      <polygon
        points={`${LAMP.x},${LAMP.y} ${x - 6},${y - 14} ${x + 6},${y + 4}`}
        fill="url(#lm-beam)"
        className={`transition-opacity duration-1000 ${isTrue ? "opacity-50" : "opacity-15"}`}
      />
      <g transform={`translate(${x} ${y})`}>
        <g className={info.finished > 0 ? "lm-turn" : ""}>
          <g className="lm-bob">
            <circle cy="-20" r="9" fill="url(#lm-lamp)" opacity="0.8" />
            <polygon points="-1,-18 -1,-3 9,-3" fill="#c9c3ae" />
            <path d="M-12 -2 L12 -2 L8 4 L-8 4 Z" fill="#202945" />
            <circle cy="-20" r="1.8" fill="#ffd76a" />
            <rect x="-14" y="-12" width="2" height="6" fill="#202945" />
          </g>
        </g>
      </g>
    </g>
  );
}

export default function LastLayer({ info }: { info: LightSceneInfo }) {
  /** The lantern is one of the lights; the rest are the dots. */
  const litDots = Math.max(0, info.lightsRemaining - 1);
  const glow = 36 + 56 * info.flame;

  return (
    <g>
      <rect x="-1200" y="-1200" width="2800" height="2800" fill="#010206" />
      <rect x="-1200" y="224" width="2800" height="1200" fill="#03081a" />
      <rect x="-1200" y="224" width="2800" height="1" fill="#16224a" />
      {LIGHTS.map((l, i) => {
        const isLit = i < litDots;
        return (
          <g key={i}>
            <circle
              cx={l.x}
              cy={l.y}
              r="16"
              fill="url(#lm-lamp)"
              className={`transition-opacity duration-[1500ms] ${isLit ? "opacity-70" : "opacity-0"}`}
            />
            <circle
              cx={l.x}
              cy={l.y}
              r="2.4"
              className={`transition-colors duration-[1500ms] ${isLit ? "fill-amber-200" : "fill-slate-800"}`}
            />
          </g>
        );
      })}
      {info.boatVisible > 0 && (
        <g className="lm-fade-up">
          {[240, 256, 272, 288].map((wy, i) => (
            <rect
              key={wy}
              x={40 + ((i * 97) % 220)}
              y={wy}
              width="34"
              height="1"
              fill="#16224a"
            />
          ))}
          <Boat info={info} />
          {info.firstShipSeconds > 0 && (
            <text
              x="200"
              y="292"
              textAnchor="middle"
              className="fill-amber-200/60 font-mono text-[8px]"
            >
              {firstShipNote(info.firstShipSeconds, info.firstShipStorm > 0)}
            </text>
          )}
        </g>
      )}
      {/* the one lantern left */}
      <path
        d="M150 300 Q165 248 188 240 L216 240 Q240 248 252 300 Z"
        fill="#0b1124"
      />
      <g transform="translate(200 240) scale(0.62)">
        <use href="#lm-mini" />
      </g>
      <g transform={`translate(${LAMP.x} ${LAMP.y})`}>
        <g className="lm-flicker">
          <circle
            r={glow}
            fill="url(#lm-lamp)"
            opacity={0.45 + 0.45 * info.flame}
          />
          <rect x="-4" y="-5" width="8" height="10" fill="#ffe28a" />
        </g>
        <g className="lm-sweep" opacity="0.4">
          <polygon points="0,0 190,-16 190,16" fill="url(#lm-beam)" />
        </g>
      </g>
      {info.finished > 0 && (
        <rect
          x="-1200"
          y="-1200"
          width="2800"
          height="2800"
          fill="#fff3b0"
          className="lm-flash pointer-events-none opacity-0"
        />
      )}
    </g>
  );
}
