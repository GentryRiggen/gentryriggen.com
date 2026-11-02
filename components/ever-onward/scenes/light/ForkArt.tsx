import type { LightSceneInfo } from "@/lib/ever-onward/universes/light";
import { LAMP, SUN, planetPoint } from "./anchors";

/**
 * What each fork in the road looks like. One small piece of art for every
 * side, drawn on top of its part's layer: the Fresnel lens and its far
 * ships or the extra keepers; the coal stack and smog or the wind farm; the
 * swarm of probes or the great mirrors; the lantern let go or the one kept.
 * Everything is decorative, and the loops (`lt-` classes in globals.css)
 * stand still under reduced motion.
 */

const fmt = (n: number): string => n.toFixed(1);

// ------------------------------------------------------------------- Coast

/** The Fresnel lens: bigger rings of glass, a long far beam, ships seen over the horizon. */
function FresnelLens() {
  return (
    <g data-testid="lt-fresnel" aria-hidden="true">
      <g transform={`translate(${LAMP.x} ${LAMP.y})`}>
        <circle
          r="27"
          fill="none"
          stroke="#bff1ff"
          strokeOpacity="0.8"
          strokeWidth="1.4"
          strokeDasharray="3 2"
          className="lt-glint"
        />
        <circle
          r="35"
          fill="none"
          stroke="#e8fbff"
          strokeOpacity="0.5"
          strokeWidth="1"
          className="lt-glint-b"
        />
        <g className="lt-far-beam">
          <polygon points="0,0 460,-7 460,7" fill="url(#lm-beam)" />
        </g>
      </g>
      {[
        { x: 372, y: 197, s: 0.6 },
        { x: 332, y: 203, s: 0.5 },
      ].map((ship) => (
        <g
          key={ship.x}
          transform={`translate(${ship.x} ${ship.y}) scale(${ship.s})`}
        >
          <g className="lt-glint-b">
            <polygon points="0,-20 0,-3 10,-3" fill="#e8e3d0" />
            <path d="M-12 -2 L12 -2 L8 4 L-8 4 Z" fill="#2a3350" />
            <circle cy="-21" r="2" fill="#ffd76a" />
          </g>
        </g>
      ))}
    </g>
  );
}

/** More keepers: three more lanterns walking the rock path. */
function ExtraKeepers() {
  return (
    <g data-testid="lt-keepers" aria-hidden="true">
      {[
        { x: 66, cls: "lt-walk" },
        { x: 98, cls: "lt-walk-b" },
        { x: 150, cls: "lt-walk-c" },
      ].map((keeper) => (
        <g key={keeper.x} transform={`translate(${keeper.x} 262)`}>
          <g className={keeper.cls}>
            <rect x="-2" y="-9" width="4" height="9" fill="#f4b860" />
            <circle cy="-11.5" r="2.5" fill="#ffd9b0" />
            <line
              x1="3"
              y1="-8"
              x2="6"
              y2="-4"
              stroke="#c9a66b"
              strokeWidth="1"
            />
            <circle cx="6.5" cy="-3" r="2.6" fill="#ffe28a" />
            <circle
              cx="6.5"
              cy="-3"
              r="6"
              fill="url(#lm-lamp)"
              opacity="0.55"
            />
          </g>
        </g>
      ))}
    </g>
  );
}

// ------------------------------------------------------------------- Night

/** Coal: a smoking stack at the end of the line, and a brown haze over the cities. */
function CoalStack() {
  const base = planetPoint(Math.asin(132 / 300), 0);
  const haze = planetPoint(0, 0);
  return (
    <g data-testid="lt-coal" aria-hidden="true">
      <ellipse
        cx="200"
        cy={fmt(haze.y + 6)}
        rx="190"
        ry="20"
        fill="#8a7a62"
        className="lt-haze"
      />
      <g transform={`translate(${fmt(base.x)} ${fmt(base.y)})`}>
        <rect x="-14" y="-12" width="28" height="12" fill="#2a2420" />
        <rect x="-5" y="-34" width="10" height="24" fill="#3a302a" />
        <rect x="-5" y="-34" width="10" height="4" fill="#b7413b" />
        <rect x="-10" y="-8" width="6" height="4" fill="#ff8a3a" />
        <rect x="2" y="-8" width="6" height="4" fill="#ffb347" />
        {[
          { cls: "lt-smog", x: 0 },
          { cls: "lt-smog-b", x: 4 },
          { cls: "lt-smog-c", x: -3 },
        ].map((puff) => (
          <circle
            key={puff.cls}
            cx={puff.x}
            cy="-38"
            r="6"
            fill="#6b6258"
            className={puff.cls}
          />
        ))}
      </g>
    </g>
  );
}

const TURBINE_OFFSETS = [118, 134, 150, 166, 182] as const;

/** Wind: a row of turbines on the horizon, more of them as they are built. */
function WindRow({ built }: { built: number }) {
  const count = 1 + Math.round(built * 4);
  return (
    <g data-testid="lt-wind" data-built={built} aria-hidden="true">
      {TURBINE_OFFSETS.slice(0, count).map((offset, i) => {
        const p = planetPoint(Math.asin(offset / 300), 0);
        return (
          <g
            key={offset}
            transform={`translate(${fmt(p.x)} ${fmt(p.y)})`}
            className="lm-pop-svg"
          >
            <rect x="-1" y="-30" width="2" height="30" fill="#dfe8ff" />
            <g transform="translate(0 -30)">
              <g className={i % 2 === 0 ? "lt-rotor" : "lt-rotor-b"}>
                <rect x="-1" y="-14" width="2" height="14" fill="#f4f8ff" />
                <rect
                  x="-1"
                  y="-14"
                  width="2"
                  height="14"
                  fill="#f4f8ff"
                  transform="rotate(120)"
                />
                <rect
                  x="-1"
                  y="-14"
                  width="2"
                  height="14"
                  fill="#f4f8ff"
                  transform="rotate(240)"
                />
              </g>
              <circle r="2" fill="#8cf0ff" />
            </g>
          </g>
        );
      })}
    </g>
  );
}

// --------------------------------------------------------------------- Sky

/** More probes: two rings of them circling the sun. */
function Swarm() {
  const ring = (radius: number, n: number, cls: string, hue: string) => (
    <g className={cls}>
      {Array.from({ length: n }, (_, i) => {
        const a = (i * 2 * Math.PI) / n;
        return (
          <g
            key={i}
            transform={`translate(${fmt(radius * Math.cos(a))} ${fmt(radius * Math.sin(a))}) rotate(${Math.round((a * 180) / Math.PI) + 90})`}
          >
            <polygon points="0,-4 3,3 -3,3" fill={hue} />
            <line
              x1="0"
              y1="3"
              x2="0"
              y2="10"
              stroke={hue}
              strokeOpacity="0.4"
            />
          </g>
        );
      })}
    </g>
  );
  return (
    <g
      data-testid="lt-swarm"
      transform={`translate(${SUN.x} ${SUN.y})`}
      aria-hidden="true"
    >
      {ring(64, 9, "lt-orbit", "#aee0ff")}
      {ring(84, 11, "lt-orbit-r", "#ffe08a")}
    </g>
  );
}

const GREAT_MIRRORS = [
  { x: 40, y: 262, s: 1.1 },
  { x: 95, y: 255, s: 1.25 },
  { x: 155, y: 251, s: 1.4 },
  { x: 245, y: 251, s: 1.4 },
  { x: 305, y: 255, s: 1.25 },
  { x: 360, y: 262, s: 1.1 },
] as const;

/** Bigger mirrors: great dishes along the horizon, each throwing a glint at the sun. */
function GreatMirrors() {
  return (
    <g data-testid="lt-mirrors" aria-hidden="true">
      {GREAT_MIRRORS.map((m, i) => (
        <g
          key={m.x}
          transform={`translate(${m.x} ${m.y}) scale(${m.s})`}
          className="lm-pop-svg"
        >
          <rect x="-1.5" y="-4" width="3" height="10" fill="#2a3350" />
          <path
            d="M-12 -4 Q0 -22 12 -4 Z"
            fill="#7fb7ff"
            stroke="#ffe08a"
            strokeWidth="0.9"
          />
          <path d="M-8 -6 Q0 -16 8 -6" fill="none" stroke="#e8f6ff" />
          <circle
            cy="-13"
            r="2"
            fill="#fff6c8"
            className={i % 2 === 0 ? "lt-glint" : "lt-glint-b"}
          />
        </g>
      ))}
    </g>
  );
}

// -------------------------------------------------------------------- Last

/** Let it go: one lantern drifts up into the dark, and its post stands empty. */
function LanternLetGo() {
  return (
    <g data-testid="lt-release" aria-hidden="true">
      <line
        x1="332"
        y1="212"
        x2="332"
        y2="262"
        stroke="#3a3f52"
        strokeWidth="2"
      />
      <path
        d="M332 214 Q344 212 346 220"
        fill="none"
        stroke="#3a3f52"
        strokeWidth="1.5"
      />
      <g transform="translate(332 226)">
        <g className="lt-float-away">
          <circle r="14" fill="url(#lm-lamp)" opacity="0.7" />
          <rect x="-4" y="-5" width="8" height="10" fill="#ffe28a" />
          <rect x="-5" y="-6" width="10" height="2" fill="#7a5a2a" />
        </g>
      </g>
    </g>
  );
}

/** Keep it: a lantern on its hook, glowing steadily, with a halo that breathes. */
function LanternKept() {
  return (
    <g data-testid="lt-keep" aria-hidden="true">
      <line
        x1="332"
        y1="212"
        x2="332"
        y2="262"
        stroke="#5b6a8c"
        strokeWidth="2"
      />
      <path
        d="M332 214 Q344 212 346 220"
        fill="none"
        stroke="#5b6a8c"
        strokeWidth="1.5"
      />
      <g transform="translate(346 228)">
        <circle r="22" fill="url(#lm-lamp)" className="lt-halo" />
        <line x1="0" y1="-8" x2="0" y2="-5" stroke="#5b6a8c" />
        <rect x="-4" y="-5" width="8" height="10" fill="#ffe28a" />
        <rect x="-5" y="-6" width="10" height="2" fill="#7a5a2a" />
        <rect x="-5" y="5" width="10" height="2" fill="#7a5a2a" />
      </g>
    </g>
  );
}

/** The art for the fork that was chosen in the current part, or nothing. */
export default function ForkArt({ info }: { info: LightSceneInfo }) {
  switch (info.phaseIndex) {
    case 0:
      return info.forkCoast === 1 ? (
        <FresnelLens />
      ) : info.forkCoast === 2 ? (
        <ExtraKeepers />
      ) : null;
    case 1:
      return info.forkNight === 1 ? (
        <CoalStack />
      ) : info.forkNight === 2 ? (
        <WindRow built={info.windBuilt} />
      ) : null;
    case 2:
      return info.forkSky === 1 ? (
        <Swarm />
      ) : info.forkSky === 2 ? (
        <GreatMirrors />
      ) : null;
    default:
      return info.forkLast === 1 ? (
        <LanternLetGo />
      ) : info.forkLast === 2 ? (
        <LanternKept />
      ) : null;
  }
}
