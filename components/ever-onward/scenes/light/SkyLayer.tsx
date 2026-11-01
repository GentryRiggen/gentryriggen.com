import type { LightSceneInfo } from "@/lib/ever-onward/universes/light";
import { makeStars } from "./random";

const SUN = { x: 200, y: 150 } as const;
const STAR_COUNT = 70;
const STARS = makeStars(41, STAR_COUNT, { ...SUN, radius: 44 });
const RINGS = [
  { radius: 48, cls: "lm-orbit-a" },
  { radius: 68, cls: "lm-orbit-b" },
  { radius: 90, cls: "lm-orbit-c" },
] as const;
const PROBE_CLASSES = ["lm-probe-a", "lm-probe-b", "lm-probe-c"] as const;
const MAX_COLLECTORS = 18;
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
const MAX_PROBES = 12;

export default function SkyLayer({ info }: { info: LightSceneInfo }) {
  const collectors =
    info.collectors > 0
      ? Math.min(
          MAX_COLLECTORS,
          1 + Math.floor(Math.log2(info.collectors + 1) * 1.8)
        )
      : 0;
  const probes =
    info.probes > 0
      ? Math.min(MAX_PROBES, 1 + Math.floor(Math.log2(info.probes + 1)))
      : 0;
  const stars = Math.ceil(info.starsFraction * STAR_COUNT);
  const glow = 0.35 + Math.min(0.5, collectors * 0.03);
  // The mirror field grows in two steps: a few mirrors, then a great field.
  const fieldMirrors =
    info.collectors >= 6
      ? FIELD_MIRRORS.length
      : info.collectors >= 3
        ? SMALL_FIELD
        : 0;

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
      <circle
        cx={SUN.x}
        cy={SUN.y}
        r={150}
        fill="url(#lm-sun)"
        opacity={glow}
      />
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
                  <g className="lm-pop-svg">
                    <rect
                      x="-3.5"
                      y="-2"
                      width="7"
                      height="4"
                      rx="1"
                      fill="#7fb7ff"
                      stroke="#ffe08a"
                      strokeWidth="0.8"
                    />
                  </g>
                </g>
              ))}
            </g>
          </g>
        );
      })}
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
      {Array.from({ length: probes }, (_, i) => (
        <g
          key={i}
          transform={`translate(${SUN.x} ${SUN.y}) rotate(${(i * 360) / MAX_PROBES + 13})`}
        >
          <g className={PROBE_CLASSES[i % PROBE_CLASSES.length]}>
            <line
              x1="-14"
              x2="0"
              stroke="#aee0ff"
              strokeOpacity={info.glow > 0 ? 1 : 0.7}
              strokeWidth={info.glow > 0 ? 1.6 : 1}
            />
            <circle r={info.glow > 0 ? 2.6 : 1.8} fill="#ffffff" />
          </g>
        </g>
      ))}
    </g>
  );
}
