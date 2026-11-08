import type { RunState } from "@/lib/ever-onward/engine/types";
import { hasKept, keptOf } from "@/lib/ever-onward/universes/smile/world";
import { Face, Robot } from "../../scenes/smile/parts";

/**
 * The ending: a bench at dusk, with the lamp on, the robot sitting very
 * still, and a friend with one small, real smile. It runs the full width of
 * the screen (a cropped, never letterboxed picture) above the closing lines.
 */
export default function SmileEndingArt({ run }: { run: RunState }) {
  const kept = Math.round(keptOf(run) * 100);
  return (
    <>
      <div
        aria-hidden="true"
        data-testid="lm-ending-art"
        className="pointer-events-none relative -mt-14 ml-[calc(50%-50vw)] h-[46dvh] w-screen overflow-hidden bg-[#1a2150] md:h-[58dvh]"
      >
        <svg
          viewBox="0 0 400 300"
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 block h-full w-full"
        >
          <defs>
            <linearGradient id="ms-end-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#1a2150" />
              <stop offset="1" stopColor="#7a5c9e" />
            </linearGradient>
            <radialGradient id="ms-end-lamp" cx="50%" cy="50%" r="50%">
              <stop offset="0" stopColor="#ffd87a" stopOpacity="0.6" />
              <stop offset="1" stopColor="#ffd87a" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect x="-1200" y="-1200" width="2800" height="2700" fill="#2b2f55" />
          <rect x="0" y="0" width="400" height="190" fill="url(#ms-end-sky)" />
          <g fill="#fff4cf">
            {[
              [30, 30],
              [90, 60],
              [150, 22],
              [260, 40],
              [330, 24],
              [360, 70],
            ].map(([x, y], i) => (
              <rect
                key={x}
                x={x}
                y={y}
                width="2"
                height="2"
                className={i % 2 ? "ms-twinkle" : "ms-twinkle-b"}
              />
            ))}
          </g>
          <rect x="0" y="190" width="400" height="110" fill="#33406e" />
          <circle
            cx="196"
            cy="160"
            r="120"
            fill="url(#ms-end-lamp)"
            className="ms-glow"
          />
          <rect x="100" y="200" width="200" height="8" fill="#8a5a2b" />
          <rect x="100" y="178" width="200" height="6" fill="#a9703a" />
          <rect x="106" y="208" width="6" height="24" fill="#5b3a1a" />
          <rect x="288" y="208" width="6" height="24" fill="#5b3a1a" />
          <rect x="166" y="180" width="26" height="24" fill="#7d93b0" />
          <g className="ms-blink">
            <Face x={164} y={154} size={30} mood="grin" />
          </g>
          <Robot x={214} y={174} />
          <g fill="#ffe29a">
            <rect x="140" y="130" width="3" height="3" className="ms-twinkle" />
            <rect
              x="240"
              y="138"
              width="3"
              height="3"
              className="ms-twinkle-b"
            />
            <rect x="204" y="118" width="3" height="3" className="ms-twinkle" />
          </g>
        </svg>
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black to-transparent" />
      </div>
      {hasKept(run) && (
        <p
          data-testid="lm-ending-kept"
          className="relative z-10 -mt-10 mb-2 text-center font-mono text-sm font-bold text-amber-100"
        >
          You kept {kept}% of the world&apos;s real smiles.
        </p>
      )}
    </>
  );
}
