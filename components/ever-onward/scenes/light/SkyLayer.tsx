import type { LightSceneInfo } from "@/lib/ever-onward/universes/light";
import { MAX_DRAWN_PROBES } from "@/lib/ever-onward/universes/light/scene";
import { AIM_DISH, LAKE, RACE, RELAY_RADIUS, SUN } from "./anchors";
import { makeStars } from "./random";

const STAR_COUNT = 70;
const STARS = makeStars(41, STAR_COUNT, { ...SUN, radius: 44 });
const RINGS = [
  { radius: 48, cls: "lm-orbit-a" },
  { radius: 68, cls: "lm-orbit-b" },
  { radius: 90, cls: "lm-orbit-c" },
] as const;
const PROBE_CLASSES = ["lm-probe-a", "lm-probe-b", "lm-probe-c"] as const;
/** Probe speed by engine tier (a multiplier on how long a trip takes). */
const PROBE_SPEED = ["", "[--lm-speed:0.65]", "[--lm-speed:0.4]"] as const;
const MAX_COLLECTORS = 6;
/** The mirror field on the ground: a few mirrors at 3 collectors, a field at 6. */
const SMALL_FIELD = 6;
const FIELD_MIRRORS = [
  { x: 40, y: 270 },
  { x: 62, y: 276 },
  { x: 84, y: 270 },
  { x: 106, y: 276 },
  { x: 128, y: 270 },
  { x: 150, y: 276 },
  { x: 250, y: 270 },
  { x: 272, y: 276 },
  { x: 294, y: 270 },
  { x: 316, y: 276 },
  { x: 338, y: 270 },
  { x: 360, y: 276 },
] as const;
const MAX_PROBES = MAX_DRAWN_PROBES;
/** Stars the star charts mark out for the fleet. */
const CHART_TARGETS = [
  { x: 60, y: 62 },
  { x: 338, y: 46 },
  { x: 352, y: 196 },
] as const;
const RELAY_COUNTS = [0, 4, 8, 12] as const;
const FLARE_RAYS = [0, 45, 90, 135, 180, 225, 270, 315] as const;

const rad = (deg: number): number => (deg * Math.PI) / 180;

/** One sun collector: a mirror with a gold frame, bigger as the mirrors grow. */
function Collector({ tier }: { tier: number }) {
  const scale = 1.35 + 0.3 * tier;
  return (
    <g className="lm-pop-svg">
      <g transform={`scale(${scale})`}>
        <rect
          x="-6"
          y="-3.5"
          width="12"
          height="7"
          rx="1"
          fill="#7fb7ff"
          stroke="#ffe08a"
          strokeWidth="1.2"
        />
        <line x1="-6" x2="6" stroke="#ffffff" strokeOpacity="0.6" />
        <line y1="-3.5" y2="3.5" stroke="#ffffff" strokeOpacity="0.6" />
      </g>
    </g>
  );
}

interface ProbeProps {
  info: LightSceneInfo;
  index: number;
}

function Probe({ info, index }: ProbeProps) {
  const isGlowing = info.glow > 0;
  const trail = 14 + 8 * info.enginesTier;
  // A fleet that has lost its course fans out; a true one flies straight.
  const spread = (index % 2 ? 1 : -1) * (1 - info.fleetHeading) * 40;
  const arm = 3 + 2.5 * info.appetiteTier;
  return (
    <g
      transform={`translate(${SUN.x} ${SUN.y}) rotate(${(index * 360) / MAX_PROBES + 13 + spread})`}
    >
      <g
        className={`${PROBE_CLASSES[index % PROBE_CLASSES.length]} ${PROBE_SPEED[Math.min(2, info.enginesTier)]}`}
      >
        <line
          x1={-trail}
          x2="0"
          stroke="#aee0ff"
          strokeOpacity={isGlowing ? 1 : 0.7}
          strokeWidth={isGlowing ? 1.6 : 1}
        />
        {/* copies the probe has made of itself, flying close behind */}
        {Array.from({ length: info.copyTier }, (_, k) => (
          <circle
            key={k}
            cx={-7 - 6 * k}
            cy={k % 2 ? 2.5 : -2.5}
            r="1.7"
            fill="#aee0ff"
          />
        ))}
        <circle r={isGlowing ? 3 : 2.4} fill="#ffffff" />
        {info.enginesTier >= 2 && (
          <polygon points="3,0 -2,-6 -2,6" fill="#ffe9a0" fillOpacity="0.8" />
        )}
        {info.appetiteTier >= 1 &&
          [-1, 1].map((side) => (
            <line
              key={side}
              x1="1"
              y1="0"
              x2={1 + arm}
              y2={side * arm}
              stroke="#ff9f6a"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          ))}
      </g>
    </g>
  );
}

/** The racing probe's dock, its loop of three waypoint stars, and mission control. */
function RaceDock({ info }: { info: LightSceneInfo }) {
  const r = RACE.loopRadius;
  return (
    <g className="lm-pop-svg">
      <circle
        cx={RACE.x}
        cy={RACE.loopY}
        r={r}
        fill="none"
        stroke="#fcd34d"
        strokeOpacity="0.35"
        strokeDasharray="3 4"
      />
      {[-90, 30, 150].map((deg) => (
        <polygon
          key={deg}
          points="0,-3.5 1.2,-1.2 3.5,0 1.2,1.2 0,3.5 -1.2,1.2 -3.5,0 -1.2,-1.2"
          fill="#fde68a"
          transform={`translate(${RACE.x + r * Math.cos(rad(deg))} ${RACE.loopY + r * Math.sin(rad(deg))})`}
        />
      ))}
      {/* the dock: a platform, a mast and a flag */}
      <g transform={`translate(${RACE.x} ${RACE.y})`}>
        <rect x="-14" y="2" width="28" height="5" fill="#475569" />
        <rect x="-14" y="2" width="28" height="2" fill="#94a3b8" />
        <rect x="9" y="-12" width="2" height="14" fill="#94a3b8" />
        <rect x="11" y="-12" width="7" height="4" fill="#f87171" />
        {info.raceOut === 0 && <RaceProbe info={info} dockAngle />}
      </g>
      {info.raceOut === 1 && (
        <g transform={`translate(${RACE.x} ${RACE.loopY})`}>
          <g className="pr-loop">
            <g transform={`translate(${r} 0) rotate(90)`}>
              <RaceProbe info={info} showsExhaust />
            </g>
          </g>
        </g>
      )}
      {/* mission control: a little dish, and its scout flying the loop wider and slower */}
      {info.raceControl === 1 && (
        <>
          <g transform={`translate(${RACE.x - 28} ${RACE.y})`}>
            <rect x="-6" y="-2" width="12" height="9" fill="#475569" />
            <path d="M-7 -2 Q0 -14 7 -2 Z" fill="#7dd3fc" stroke="#e0f2fe" />
          </g>
          {info.raceScout === 1 && (
            <g transform={`translate(${RACE.x} ${RACE.loopY})`}>
              <g className="pr-loop-slow">
                <circle
                  cx={r + 9}
                  r="2.4"
                  fill="#7dd3fc"
                  stroke="#e0f2fe"
                  strokeWidth="0.8"
                />
              </g>
            </g>
          )}
        </>
      )}
    </g>
  );
}

interface RaceProbeProps {
  info: LightSceneInfo;
  dockAngle?: boolean;
  showsExhaust?: boolean;
}

/** The racing probe: a white arrow (with red fins once bought). */
function RaceProbe({ info, dockAngle, showsExhaust }: RaceProbeProps) {
  return (
    <g transform={dockAngle ? "translate(0 -5) rotate(-90)" : undefined}>
      {showsExhaust && (
        <polygon
          points="-4,0 -15,-2.6 -15,2.6"
          fill="#fb923c"
          fillOpacity="0.85"
          className="pr-exhaust"
        />
      )}
      {info.raceFins === 1 && (
        <>
          <polygon points="-4,0 -8,-5 -1,-2" fill="#f87171" />
          <polygon points="-4,0 -8,5 -1,2" fill="#f87171" />
        </>
      )}
      <polygon
        points="6,0 -3,-3.6 -1.5,0 -3,3.6"
        fill="#ffffff"
        stroke="#facc15"
        strokeWidth="1"
      />
    </g>
  );
}

export default function SkyLayer({ info }: { info: LightSceneInfo }) {
  const collectors = Math.min(MAX_COLLECTORS, Math.max(0, info.collectors));
  const probes = info.probes;
  const stars = Math.ceil(info.starsFraction * STAR_COUNT);
  const glow = 0.35 + Math.min(0.5, collectors * 0.05);
  // The mirror field grows in two steps: a few mirrors, then a great field.
  const fieldMirrors =
    info.collectors >= 6
      ? FIELD_MIRRORS.length
      : info.collectors >= 3
        ? SMALL_FIELD
        : 0;
  const relays = RELAY_COUNTS[Math.min(3, info.relayTier)];
  const aimWidth = Math.max(2, 16 - 2.6 * info.aimLevel);

  return (
    <g>
      <rect x="-1200" y="-1200" width="2800" height="2800" fill="#02030a" />
      {STARS.slice(0, stars).map((s, i) => (
        <circle
          key={i}
          cx={s.x}
          cy={s.y}
          r={s.r}
          fill="#dfe8ff"
          className={s.twinkle}
        />
      ))}
      {/* star charts: the stars the fleet is heading for */}
      {info.navTier >= 1 &&
        CHART_TARGETS.map((t) => (
          <g key={`${t.x}-${t.y}`} className="lm-pop-svg">
            <line
              x1={SUN.x}
              y1={SUN.y}
              x2={t.x}
              y2={t.y}
              stroke="#8cf0ff"
              strokeOpacity="0.35"
              strokeDasharray="3 4"
            />
            <circle
              cx={t.x}
              cy={t.y}
              r="6"
              fill="none"
              stroke="#8cf0ff"
              strokeWidth="1.2"
            />
            <circle cx={t.x} cy={t.y} r="2" fill="#ffffff" />
          </g>
        ))}
      <circle
        cx={SUN.x}
        cy={SUN.y}
        r={150}
        fill="url(#lm-sun)"
        opacity={glow}
      />
      {info.flare > 0 && (
        <g transform={`translate(${SUN.x} ${SUN.y})`} className="lm-glow">
          <circle r="40" fill="url(#lm-sun)" />
          {FLARE_RAYS.map((a) => (
            <line
              key={a}
              x1={30 * Math.cos(rad(a))}
              y1={30 * Math.sin(rad(a))}
              x2={52 * Math.cos(rad(a))}
              y2={52 * Math.sin(rad(a))}
              stroke="#fff3b0"
              strokeWidth="3"
              strokeLinecap="round"
            />
          ))}
        </g>
      )}
      {RINGS.map((ring) => (
        <circle
          key={ring.radius}
          cx={SUN.x}
          cy={SUN.y}
          r={ring.radius}
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.07"
        />
      ))}
      <circle cx={SUN.x} cy={SUN.y} r="26" fill="#ffd35a" />
      <circle cx={SUN.x} cy={SUN.y} r="20" fill="#fff0a8" />
      {/* a ring of small mirrors around the sun */}
      {info.mirrorTier >= 2 && (
        <g transform={`translate(${SUN.x} ${SUN.y})`}>
          <g className="lm-orbit-b">
            {Array.from({ length: 8 }, (_, i) => (
              <rect
                key={i}
                x="-3"
                y="-1.5"
                width="6"
                height="3"
                fill="#7fb7ff"
                stroke="#ffe08a"
                strokeWidth="0.8"
                transform={`rotate(${i * 45}) translate(34 0)`}
              />
            ))}
          </g>
        </g>
      )}
      {RINGS.map((ring, ringIndex) => {
        const items = Array.from({ length: collectors }, (_, i) => i).filter(
          (i) => i % RINGS.length === ringIndex
        );
        return (
          <g key={ring.radius} transform={`translate(${SUN.x} ${SUN.y})`}>
            <g className={ring.cls}>
              {items.map((item, k) => (
                <g
                  key={item}
                  transform={`rotate(${(k / items.length) * 360 + ringIndex * 40}) translate(${ring.radius} 0)`}
                >
                  <Collector tier={info.mirrorTier} />
                </g>
              ))}
            </g>
          </g>
        );
      })}
      {/* relay stations ring the whole sky and listen */}
      {relays > 0 && (
        <g transform={`translate(${SUN.x} ${SUN.y})`}>
          {info.relayTier >= 2 && (
            <circle
              r={RELAY_RADIUS}
              fill="none"
              stroke="#8cf0ff"
              strokeOpacity="0.3"
              strokeDasharray="2 4"
            />
          )}
          {Array.from({ length: relays }, (_, i) => {
            const a = rad((i * 360) / relays - 90);
            const x = RELAY_RADIUS * Math.cos(a);
            const y = RELAY_RADIUS * Math.sin(a);
            return (
              <g key={`${relays}-${i}`} transform={`translate(${x} ${y})`}>
                {info.relayTier >= 3 && (
                  <line
                    x2={-x * 0.8}
                    y2={-y * 0.8}
                    stroke="#8cf0ff"
                    strokeOpacity="0.2"
                  />
                )}
                <g className="lm-pop-svg">
                  <polygon
                    points="0,-5 5,0 0,5 -5,0"
                    fill="#8cf0ff"
                    stroke="#ffffff"
                    strokeWidth="0.8"
                  />
                </g>
              </g>
            );
          })}
        </g>
      )}
      {fieldMirrors > 0 && (
        <g className="lm-pop-svg">
          <path
            d="M-1200 300 L-1200 282 Q60 262 200 276 Q340 262 1600 282 L1600 300 Z"
            fill="#0b1124"
          />
          {FIELD_MIRRORS.slice(0, fieldMirrors).map((m) => (
            <g key={`${m.x}-${m.y}`}>
              <line
                x1={m.x}
                y1={m.y}
                x2={SUN.x}
                y2={SUN.y + 30}
                stroke="#ffe08a"
                strokeOpacity="0.1"
              />
              <rect
                x={m.x - 7}
                y={m.y - 3}
                width="14"
                height="5"
                rx="1"
                fill="#7fb7ff"
                stroke="#ffe08a"
                strokeWidth="0.8"
                transform={`rotate(${(SUN.x - m.x) / 14} ${m.x} ${m.y})`}
              />
            </g>
          ))}
        </g>
      )}
      {/* the lake mirror throws the sun's reflection back */}
      {info.mirrorTier >= 3 && (
        <g className="lm-pop-svg">
          <ellipse
            cx={LAKE.x}
            cy={LAKE.y}
            rx="62"
            ry="8"
            fill="#4f8fe0"
            fillOpacity="0.65"
            stroke="#bfe0ff"
            strokeWidth="1"
          />
          <ellipse
            cx={LAKE.x}
            cy={LAKE.y}
            rx="22"
            ry="3"
            fill="#fff0a8"
            className="lm-twinkle"
          />
        </g>
      )}
      {/* the aiming dish: its beam gets thinner and brighter as the aim steadies */}
      <g transform={`translate(${AIM_DISH.x} ${AIM_DISH.y})`}>
        <polygon
          points={`${-aimWidth},-8 ${aimWidth},-8 3,${SUN.y + 30 - AIM_DISH.y} -3,${SUN.y + 30 - AIM_DISH.y}`}
          fill="#ffe08a"
          fillOpacity={0.05 + 0.03 * info.aimLevel}
        />
        <rect x="-5" y="-3" width="10" height="5" fill="#2a3350" />
        <path d="M-9 -4 Q0 -14 9 -4 Z" fill="#7fb7ff" stroke="#ffe08a" />
        {Array.from({ length: info.aimLevel }, (_, i) => (
          <rect
            key={i}
            x={-11 + i * 4.5}
            y="5"
            width="3"
            height="3"
            fill="#ffd35a"
          />
        ))}
      </g>
      {/* steady glow: the fleet flies in formation, on one bright ring */}
      {info.glow > 0 && probes > 1 && (
        <circle
          cx={SUN.x}
          cy={SUN.y}
          r="14"
          fill="none"
          stroke="#aee0ff"
          strokeOpacity="0.5"
          strokeDasharray="2 3"
          className="lm-pop-svg"
        />
      )}
      {/* a navigator mind keeps the fleet on course */}
      {info.navTier >= 2 && probes > 0 && (
        <g transform={`translate(${SUN.x} ${SUN.y})`}>
          <circle
            r="32"
            fill="none"
            stroke="#8cf0ff"
            strokeOpacity="0.55"
            strokeDasharray="4 4"
            className="lm-orbit-c"
          />
        </g>
      )}
      {Array.from({ length: probes }, (_, i) => (
        <Probe key={i} info={info} index={i} />
      ))}
      {info.raceOpen === 1 && <RaceDock info={info} />}
    </g>
  );
}
