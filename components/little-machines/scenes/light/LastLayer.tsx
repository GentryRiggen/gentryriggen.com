import type { LightSceneInfo } from "@/lib/little-machines/universes/light";

const LIGHT_COUNT = 11;
const LIGHTS = Array.from({ length: LIGHT_COUNT }, (_, i) => ({
  x: 30 + i * 34,
  y: 120 + 45 * Math.sin(i * 2.1),
}));

export default function LastLayer({ info }: { info: LightSceneInfo }) {
  /** The lantern is one of the lights; the rest are the dots. */
  const litDots = Math.max(0, info.lightsRemaining - 1);

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
      {/* the one lantern left */}
      <path
        d="M150 300 Q165 248 188 240 L216 240 Q240 248 252 300 Z"
        fill="#0b1124"
      />
      <g transform="translate(200 240) scale(0.62)">
        <use href="#lm-mini" />
      </g>
      <g transform="translate(200 166)">
        <g className="lm-flicker">
          <circle r="64" fill="url(#lm-lamp)" opacity="0.8" />
          <rect x="-4" y="-5" width="8" height="10" fill="#ffe28a" />
        </g>
        <g className="lm-sweep" opacity="0.4">
          <polygon points="0,0 190,-16 190,16" fill="url(#lm-beam)" />
        </g>
      </g>
      {info.remembered > 0 && (
        <g transform="translate(300 250) scale(0.9)">
          <g className="lm-approach">
            <g className="lm-bob">
              <circle cy="-20" r="9" fill="url(#lm-lamp)" opacity="0.8" />
              <polygon points="-1,-18 -1,-3 9,-3" fill="#c9c3ae" />
              <path d="M-12 -2 L12 -2 L8 4 L-8 4 Z" fill="#202945" />
              <circle cy="-20" r="1.8" fill="#ffd76a" />
              <rect x="-14" y="-12" width="2" height="6" fill="#202945" />
            </g>
          </g>
        </g>
      )}
    </g>
  );
}
