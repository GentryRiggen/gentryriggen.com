interface EggArtProps {
  taps: number;
  /** Bumps on each tap to replay the wobble. */
  hit: number;
  className?: string;
}

/** The ember egg, with a crack for every tap. */
export default function EggArt({
  taps,
  hit,
  className = "size-full",
}: EggArtProps) {
  return (
    <svg
      viewBox="0 0 120 150"
      aria-hidden="true"
      className={`${className} ${hit === 0 ? "fl-egg-wobble" : "fl-egg-hit"}`}
      key={hit}
    >
      <defs>
        <radialGradient id="fl-egg-fill" cx="0.4" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#ffd9a0" />
          <stop offset="0.6" stopColor="#ff9a3c" />
          <stop offset="1" stopColor="#d9551c" />
        </radialGradient>
      </defs>
      <path
        d="M60 8 C95 8 112 62 112 96 C112 128 90 144 60 144 C30 144 8 128 8 96 C8 62 25 8 60 8 Z"
        fill="url(#fl-egg-fill)"
      />
      <circle cx="38" cy="70" r="7" fill="#ffe3b3" opacity="0.7" />
      <circle cx="82" cy="100" r="9" fill="#ffe3b3" opacity="0.6" />
      <circle cx="52" cy="118" r="5" fill="#ffe3b3" opacity="0.6" />
      <g
        fill="none"
        stroke="#5a2a10"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {taps >= 1 && <path d="M60 30 L54 44 L64 52" />}
        {taps >= 2 && <path d="M30 80 L44 76 L50 90" />}
        {taps >= 3 && <path d="M92 74 L80 82 L84 96" />}
        {taps >= 4 && <path d="M40 112 L52 106 L58 120 L70 112" />}
      </g>
    </svg>
  );
}
