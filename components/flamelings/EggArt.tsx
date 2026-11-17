import { useId } from "react";

interface EggArtProps {
  taps: number;
  /** Bumps on each tap to replay the wobble. */
  hit: number;
  className?: string;
}

const EGG =
  "M60 8 C95 8 112 62 112 96 C112 128 90 144 60 144 C30 144 8 128 8 96 C8 62 25 8 60 8 Z";

/** The split line, top to bottom: one stretch more cracks open per tap. */
const SPLIT = "L56 122 L66 106 L54 90 L66 74 L52 58 L64 42 L54 28 Z";

/** The crack drawn on each tap: the split line plus a little branch. */
const CRACKS = [
  "M60 8 L54 28 L64 42",
  "M64 42 L52 58 L66 74 M52 58 L39 62 L32 56",
  "M66 74 L54 90 L66 106 M66 74 L81 70 L89 78",
  "M66 106 L56 122 L60 144 M54 90 L38 97 M66 106 L83 113",
];

/** Faint inner light behind the egg: brighter with every tap. */
const GLOW_BY_TAPS = [
  "opacity-25",
  "opacity-40",
  "opacity-55",
  "opacity-75",
  "opacity-90",
];

/** Where the little sparkles fly on a tap. */
const SPARKS = [
  "left-[18%] top-[22%] [--fl-dx:-34px] [--fl-dy:-26px]",
  "right-[18%] top-[30%] [--fl-dx:36px] [--fl-dy:-20px]",
  "left-[24%] top-[52%] [--fl-dx:-38px] [--fl-dy:8px]",
  "right-[22%] top-[48%] [--fl-dx:34px] [--fl-dy:14px]",
];

/** A twig nest. `back` sits behind the egg or pet, `front` in front of it. */
export function EggNest({
  part,
  className = "",
}: {
  part: "back" | "front";
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 160 56"
      aria-hidden="true"
      className={`pointer-events-none ${className}`}
    >
      {part === "back" ? (
        <>
          <ellipse cx="80" cy="22" rx="66" ry="13" fill="#5b3220" />
          <ellipse cx="80" cy="24" rx="56" ry="9" fill="#3d2016" />
          <path
            d="M20 18 q14 -9 30 -3 M110 15 q18 -6 32 4"
            stroke="#9a6a44"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <path
            d="M10 22 Q80 44 150 22 Q153 38 130 47 Q80 60 30 47 Q7 38 10 22 Z"
            fill="#8a5230"
          />
          <g fill="none" strokeLinecap="round">
            <path
              d="M12 26 Q46 40 84 38 T148 26"
              stroke="#c08a5c"
              strokeWidth="3.5"
            />
            <path
              d="M18 34 Q56 48 96 44 T144 32"
              stroke="#6d3c20"
              strokeWidth="3"
            />
            <path
              d="M26 42 Q70 54 116 47 T140 38"
              stroke="#b07b52"
              strokeWidth="3"
            />
            <path
              d="M4 22 L22 30 M156 20 L136 30 M40 46 L28 54 M118 48 L132 55"
              stroke="#8a5230"
              strokeWidth="3"
            />
          </g>
          <ellipse
            cx="34"
            cy="36"
            rx="7"
            ry="3.2"
            fill="#7fb069"
            transform="rotate(-24 34 36)"
          />
          <ellipse
            cx="126"
            cy="38"
            rx="6.5"
            ry="3"
            fill="#93c47d"
            transform="rotate(22 126 38)"
          />
        </>
      )}
    </svg>
  );
}

/** One half of the shell, flying off when the egg hatches. */
export function EggShell({
  side,
  className = "",
}: {
  side: "left" | "right";
  className?: string;
}) {
  const outline =
    side === "left"
      ? "M60 8 C25 8 8 62 8 96 C8 128 30 144 60 144"
      : "M60 8 C95 8 112 62 112 96 C112 128 90 144 60 144";
  return (
    <svg
      viewBox="0 0 120 150"
      aria-hidden="true"
      className={`pointer-events-none ${className}`}
    >
      <path
        d={`${outline} ${SPLIT}`}
        fill={side === "left" ? "#ffb066" : "#f28a3c"}
        stroke="#d9551c"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle
        cx={side === "left" ? 38 : 84}
        cy={side === "left" ? 70 : 98}
        r="7"
        fill="#ffe3b3"
        opacity="0.7"
      />
    </svg>
  );
}

/**
 * The ember egg in its twig nest. It wobbles harder and cracks a little
 * more with every tap, with light leaking out of the cracks.
 */
export default function EggArt({
  taps,
  hit,
  className = "size-full",
}: EggArtProps) {
  const id = useId().replace(/:/g, "");
  const fill = `fl-egg-fill-${id}`;
  const shade = `fl-egg-shade-${id}`;
  const level = Math.min(Math.max(taps, 0), 4);
  // Two names for the same bump, so each tap restarts it.
  const bump = hit === 0 ? "" : hit % 2 ? "fl-egg-hit" : "fl-egg-hit-b";
  return (
    <div aria-hidden="true" className={`relative ${className}`}>
      <div
        className={`absolute inset-[-6%] rounded-full bg-[radial-gradient(circle_at_50%_55%,rgba(255,214,120,.9)_0%,rgba(255,150,60,.45)_38%,transparent_68%)] transition-opacity duration-500 ${GLOW_BY_TAPS[level]}`}
      />
      <EggNest
        part="back"
        className="absolute left-[-4%] bottom-[1%] w-[108%]"
      />
      <div
        className={`absolute inset-x-[13%] bottom-[9%] top-[2%] fl-egg-wobble-${level + 1}`}
      >
        <svg
          viewBox="0 0 120 150"
          className={`size-full overflow-visible ${bump}`}
        >
          <defs>
            <radialGradient id={fill} cx="0.38" cy="0.32" r="0.85">
              <stop offset="0" stopColor="#fff0c8" />
              <stop offset="0.45" stopColor="#ffb066" />
              <stop offset="1" stopColor="#e2601f" />
            </radialGradient>
            <linearGradient id={shade} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0.6" stopColor="#b8360f" stopOpacity="0" />
              <stop offset="1" stopColor="#b8360f" stopOpacity="0.35" />
            </linearGradient>
          </defs>
          <path d={EGG} fill={`url(#${fill})`} />
          <path d={EGG} fill={`url(#${shade})`} />
          <ellipse
            cx="40"
            cy="44"
            rx="10"
            ry="17"
            fill="#fff"
            opacity="0.45"
            transform="rotate(18 40 44)"
          />
          <circle cx="36" cy="84" r="6" fill="#ff8a3d" opacity="0.55" />
          <circle cx="84" cy="62" r="8" fill="#ff8a3d" opacity="0.5" />
          <circle cx="78" cy="112" r="5" fill="#ff8a3d" opacity="0.5" />
          <circle cx="48" cy="120" r="3.5" fill="#ff8a3d" opacity="0.5" />
          {CRACKS.slice(0, level).map((d) => (
            <g key={d} className="fl-crack" strokeLinecap="round" fill="none">
              <path
                d={d}
                className="fl-crack-glow"
                stroke="#fff3b0"
                strokeWidth="8"
                strokeLinejoin="round"
                opacity="0.75"
              />
              <path
                d={d}
                stroke="#6b2a0c"
                strokeWidth="3"
                strokeLinejoin="round"
              />
            </g>
          ))}
        </svg>
      </div>
      <EggNest
        part="front"
        className="absolute left-[-4%] bottom-[1%] w-[108%]"
      />
      {hit > 0 &&
        SPARKS.map((spot, i) => (
          <svg
            key={`${hit}-${i}`}
            viewBox="0 0 24 24"
            className={`fl-egg-spark absolute size-5 ${spot}`}
          >
            <path
              d="M12 1 l2.6 8.4 L23 12 l-8.4 2.6 L12 23 l-2.6 -8.4 L1 12 l8.4 -2.6z"
              fill="#fff3b0"
            />
          </svg>
        ))}
    </div>
  );
}
