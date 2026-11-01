import type { LightSceneInfo } from "@/lib/little-machines/universes/light";
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
              strokeOpacity="0.7"
              strokeWidth="1"
            />
            <circle r="1.8" fill="#ffffff" />
          </g>
        </g>
      ))}
    </g>
  );
}
