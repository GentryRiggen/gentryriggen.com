import type { RunState } from "@/lib/ever-onward/engine/types";
import { Plant, Robot, Visitors } from "../../scenes/grow/SeedLayer";

const STARS: readonly (readonly [number, number])[] = [
  [20, 10],
  [64, 30],
  [118, 8],
  [150, 52],
  [186, 20],
  [236, 14],
  [276, 46],
  [330, 18],
  [372, 38],
  [40, 80],
  [300, 90],
];

/**
 * The ending: one window at night, the pot in bloom with the light left on,
 * and then a grown-up and a little one at the sill. It runs the
 * full width of the screen (a cropped, never letterboxed picture) above the
 * closing lines.
 * The figures arrive slowly after the first line, and sit still at once for
 * anyone who prefers reduced motion.
 */
export default function GrowEndingArt({ run }: { run: RunState }) {
  void run;
  return (
    <div
      aria-hidden="true"
      data-testid="lm-ending-art"
      className="pointer-events-none relative -mt-14 ml-[calc(50%-50vw)] h-[46dvh] w-screen overflow-hidden bg-[#0b0820] md:h-[58dvh]"
    >
      <svg
        viewBox="0 0 400 300"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 block h-full w-full"
      >
        <defs>
          <linearGradient id="ge-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#060a1d" />
            <stop offset="1" stopColor="#1d2c58" />
          </linearGradient>
          <radialGradient id="ge-lamp" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#ffd87a" stopOpacity="0.55" />
            <stop offset="1" stopColor="#ffd87a" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x="-1200" y="-1200" width="2800" height="2700" fill="#14102a" />
        <g transform="translate(14 0)">
          <rect x="92" y="16" width="216" height="170" fill="url(#ge-sky)" />
          {STARS.map(([x, y], i) => (
            <rect
              key={x}
              x={92 + x * 0.54}
              y={20 + y}
              width="2"
              height="2"
              fill="#fff4cf"
              className={i % 3 === 0 ? "lm-twinkle" : ""}
            />
          ))}
          <circle cx="262" cy="58" r="14" fill="#fff4cf" fillOpacity="0.12" />
          <circle cx="262" cy="58" r="8" fill="#fff4cf" />
          <rect x="92" y="130" width="216" height="56" fill="#14392f" />
          <rect x="92" y="122" width="70" height="12" fill="#1c4a3c" />
          <rect x="230" y="116" width="78" height="18" fill="#1c4a3c" />
          <rect x="92" y="156" width="216" height="30" fill="#0e2a24" />
          <rect x="136" y="124" width="16" height="10" fill="#14392f" />
          <rect x="134" y="122" width="20" height="4" fill="#2e6b52" />
          <rect x="92" y="16" width="216" height="8" fill="#6b4423" />
          <rect x="92" y="16" width="8" height="176" fill="#6b4423" />
          <rect x="300" y="16" width="8" height="176" fill="#6b4423" />
          <rect x="82" y="14" width="30" height="108" fill="#6b3342" />
          <rect x="288" y="14" width="30" height="108" fill="#6b3342" />
          <rect x="74" y="186" width="252" height="12" fill="#a06a3c" />
          <rect x="74" y="198" width="252" height="6" fill="#6b4423" />
          <circle
            cx="200"
            cy="130"
            r="120"
            fill="url(#ge-lamp)"
            className="gs-glow"
          />
          <g>
            <rect x="184" y="164" width="32" height="22" fill="#c1623a" />
            <rect x="180" y="158" width="40" height="8" fill="#d9774a" />
            <rect x="183" y="157" width="34" height="3" fill="#3b2412" />
          </g>
          <Plant stage="bloom" growth={100} />
          <g>
            <rect x="120" y="170" width="16" height="2" fill="#3b3b4a" />
            <rect x="119" y="172" width="18" height="14" fill="#3b3b4a" />
            <rect x="122" y="174" width="12" height="9" fill="#ffd87a" />
          </g>
          <Robot />
          <Visitors />
        </g>
      </svg>
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black to-transparent" />
    </div>
  );
}
