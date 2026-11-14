import type { RunState } from "@/lib/ever-onward/engine/types";
import {
  KEEPSAKES,
  carriedIndexes,
  carriedWords,
  endingWarmth,
} from "@/lib/ever-onward/universes/higher/keepsakes";
import KeepsakeSprite from "../../scenes/higher/KeepsakeArt";
import Px, { Person } from "../../scenes/higher/Px";

const STARS: readonly (readonly [number, number])[] = [
  [20, 10],
  [64, 30],
  [118, 8],
  [150, 52],
  [236, 14],
  [276, 46],
  [330, 18],
  [372, 38],
];

/**
 * The ending: dusk on a patch of grass, a small robot and a kid with a few
 * blocks, and a very small tower between them. Far behind, the great tower
 * keeps all its lights on. It runs the full width of the screen (cropped,
 * never letterboxed) above the closing lines, and sits still at once for
 * anyone who prefers reduced motion.
 */
export default function HigherEndingArt({ run }: { run: RunState }) {
  const carried = carriedIndexes(run);
  const warmth = endingWarmth(run);
  return (
    <div
      aria-hidden="true"
      data-testid="lm-ending-art"
      className="pointer-events-none relative -mt-14 ml-[calc(50%-50vw)] h-[46dvh] w-screen overflow-hidden bg-[#1b1740] md:h-[58dvh]"
    >
      <svg
        viewBox="0 0 400 300"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 block h-full w-full"
      >
        <Px x={-1200} y={-1200} w={2800} h={1330} c="#2a2560" />
        <Px x={-1200} y={110} w={2800} h={60} c="#e8908a" o={0.55} />
        <Px x={-1200} y={150} w={2800} h={40} c="#f6c68a" o={0.6} />
        <g className="bh-twinkle">
          {STARS.map(([x, y]) => (
            <Px key={x} x={x} y={y} w={2} h={2} c="#fff4cf" />
          ))}
        </g>
        {/* the great tower, far off, every window lit and nobody looking out */}
        <Px x={300} y={20} w={46} h={170} c="#39425e" />
        {Array.from({ length: 12 }, (_, f) => (
          <g key={f}>
            <Px x={306} y={26 + f * 14} w={6} h={5} c="#ffe9a0" />
            <Px x={318} y={26 + f * 14} w={6} h={5} c="#ffe9a0" />
            <Px
              x={330}
              y={26 + f * 14}
              w={6}
              h={5}
              c="#ffe9a0"
              o={f % 4 === 1 ? 0.3 : 1}
            />
          </g>
        ))}
        <Px x={-1200} y={190} w={2800} h={120} c="#6fbf62" />
        <Px x={-1200} y={190} w={2800} h={4} c="#8fd67a" />
        {/* the robot, the kid and the very small tower */}
        <g className="bh-glow">
          <circle cx="204" cy="176" r="40" fill="#ffd45e" fillOpacity="0.16" />
        </g>
        <Px x={196} y={216} w={14} h={14} c="#a4813f" />
        <Px x={198} y={202} w={14} h={14} c="#e8554e" />
        <Px x={200} y={188} w={14} h={14} c="#4aa3df" />
        <g className="bh-bob">
          <Px x={128} y={186} w={12} h={10} c="#9fb4c8" />
          <Px x={131} y={189} w={2} h={2} c="#1c2432" />
          <Px x={135} y={189} w={2} h={2} c="#1c2432" />
          <Px x={125} y={196} w={18} h={18} c="#6f8aa3" />
          <Px x={130} y={214} w={4} h={8} c="#4a5d70" />
          <Px x={136} y={214} w={4} h={8} c="#4a5d70" />
        </g>
        <g className="bh-hop">
          <Person x={232} y={206} body="#6cc070" />
        </g>
        {carried.length > 0 && (
          <g data-testid="lm-ending-keepsakes" data-count={carried.length}>
            <g className="bh-glow">
              <ellipse
                cx={290}
                cy={204}
                rx={30 + carried.length * 10}
                ry={16 + warmth * 2}
                fill="#ffd45e"
                fillOpacity={0.2 + Math.min(0.3, warmth * 0.04)}
              />
            </g>
            {carried.map((id, n) => (
              <g
                key={id}
                transform={`translate(${290 + (n - (carried.length - 1) / 2) * 20 - 8} 194) scale(1.3)`}
              >
                <KeepsakeSprite id={KEEPSAKES[id].id} x={0} y={0} />
              </g>
            ))}
          </g>
        )}
        <Px x={240} y={224} w={10} h={10} c="#f2b134" />
        <Px x={254} y={228} w={8} h={8} c="#ff8fb1" />
      </svg>
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black to-transparent" />
      <p
        data-testid="lm-ending-carried"
        className="absolute inset-x-0 bottom-2 px-4 text-center font-mono text-sm font-bold text-amber-100 md:text-base"
      >
        It carried {carriedWords(run)} all the way down.
      </p>
    </div>
  );
}
