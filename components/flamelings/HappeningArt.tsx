import type { VisitorId } from "@/lib/flamelings/happenings";

/**
 * The little pictures for happenings, each drawn in a 100x100 box. Decoration
 * only (the buttons around them carry the labels).
 */
interface ArtProps {
  className?: string;
}

function Svg({
  className,
  children,
}: ArtProps & { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 100 100"
      className={className}
    >
      {children}
    </svg>
  );
}

const OUTLINE = "#00000026";

const OWL = (
  <>
    <ellipse cx="50" cy="94" rx="22" ry="4" fill="#0000001f" />
    <path d="M26 30 L32 12 L42 26 Z M74 30 L68 12 L58 26 Z" fill="#7a5230" />
    <ellipse cx="50" cy="58" rx="32" ry="36" fill="#9a6a3c" stroke={OUTLINE} />
    <ellipse cx="50" cy="68" rx="20" ry="22" fill="#e9cf9e" />
    <path
      d="M40 62 q4 3 8 0 M52 62 q4 3 8 0 M42 74 q4 3 8 0 M54 74 q4 3 8 0"
      stroke="#b88d55"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
    />
    <circle cx="36" cy="40" r="13" fill="#fff" stroke={OUTLINE} />
    <circle cx="64" cy="40" r="13" fill="#fff" stroke={OUTLINE} />
    <circle cx="37" cy="41" r="6.5" fill="#2a1a10" />
    <circle cx="63" cy="41" r="6.5" fill="#2a1a10" />
    <circle cx="39" cy="38.5" r="2.2" fill="#fff" />
    <circle cx="65" cy="38.5" r="2.2" fill="#fff" />
    <path d="M45 48 L55 48 L50 58 Z" fill="#f0a030" stroke="#b8741a" />
    <path
      d="M20 62 Q12 76 24 86 Q30 74 28 62 Z M80 62 Q88 76 76 86 Q70 74 72 62 Z"
      fill="#7a5230"
    />
    <path
      d="M40 92 l-3 5 M44 92 l0 5 M56 92 l0 5 M60 92 l3 5"
      stroke="#f0a030"
      strokeWidth="3"
      strokeLinecap="round"
    />
  </>
);

const SNAIL = (
  <>
    <ellipse cx="50" cy="90" rx="38" ry="4" fill="#0000001f" />
    <path
      d="M10 88 Q8 74 22 74 L72 74 Q94 74 92 88 Z"
      fill="#e8c9a0"
      stroke={OUTLINE}
    />
    <path
      d="M22 76 Q18 52 24 40 M30 76 Q32 50 38 36"
      stroke="#e8c9a0"
      strokeWidth="5"
      strokeLinecap="round"
      fill="none"
    />
    <circle cx="24" cy="38" r="5" fill="#fff" stroke={OUTLINE} />
    <circle cx="38" cy="34" r="5" fill="#fff" stroke={OUTLINE} />
    <circle cx="24" cy="39" r="2.4" fill="#2a1a10" />
    <circle cx="38" cy="35" r="2.4" fill="#2a1a10" />
    <path
      d="M14 82 q5 4 10 0"
      stroke="#a9805a"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
    />
    <circle
      cx="62"
      cy="54"
      r="28"
      fill="#f59a3a"
      stroke="#b8651a"
      strokeWidth="2"
    />
    <path
      d="M62 54 m0 0 a5 5 0 1 1 5 5 a10 10 0 1 1 -10 -10 a15 15 0 1 1 15 15"
      stroke="#b8651a"
      strokeWidth="3"
      fill="none"
      strokeLinecap="round"
    />
  </>
);

const FROG = (
  <>
    <ellipse cx="50" cy="92" rx="30" ry="4" fill="#0000001f" />
    <path
      d="M20 88 Q10 60 30 52 L70 52 Q90 60 80 88 Z"
      fill="#5fbf55"
      stroke="#3f8f3a"
      strokeWidth="2"
    />
    <ellipse cx="50" cy="76" rx="18" ry="12" fill="#c9f0a8" />
    <circle
      cx="32"
      cy="40"
      r="14"
      fill="#5fbf55"
      stroke="#3f8f3a"
      strokeWidth="2"
    />
    <circle
      cx="68"
      cy="40"
      r="14"
      fill="#5fbf55"
      stroke="#3f8f3a"
      strokeWidth="2"
    />
    <circle cx="32" cy="38" r="9" fill="#fff" />
    <circle cx="68" cy="38" r="9" fill="#fff" />
    <circle cx="33" cy="39" r="4.5" fill="#2a1a10" />
    <circle cx="67" cy="39" r="4.5" fill="#2a1a10" />
    <circle cx="35" cy="37" r="1.6" fill="#fff" />
    <circle cx="69" cy="37" r="1.6" fill="#fff" />
    <path
      d="M32 62 Q50 76 68 62"
      stroke="#2f6f2a"
      strokeWidth="3"
      fill="none"
      strokeLinecap="round"
    />
    <circle cx="26" cy="64" r="4" fill="#ff9aa8" opacity="0.7" />
    <circle cx="74" cy="64" r="4" fill="#ff9aa8" opacity="0.7" />
    <path
      d="M14 88 q-6 4 -2 8 q6 -2 10 -8 M86 88 q6 4 2 8 q-6 -2 -10 -8"
      fill="#5fbf55"
      stroke="#3f8f3a"
      strokeWidth="2"
    />
  </>
);

const BUTTERFLY = (
  <>
    <g className="fl-flutter">
      <path
        d="M50 46 Q18 10 10 38 Q6 58 50 52 Z"
        fill="#ff7ab6"
        stroke="#c94a88"
        strokeWidth="2"
      />
      <path
        d="M50 46 Q82 10 90 38 Q94 58 50 52 Z"
        fill="#ff7ab6"
        stroke="#c94a88"
        strokeWidth="2"
      />
      <path
        d="M50 54 Q20 60 22 82 Q36 92 50 62 Z"
        fill="#b48cff"
        stroke="#7a52c9"
        strokeWidth="2"
      />
      <path
        d="M50 54 Q80 60 78 82 Q64 92 50 62 Z"
        fill="#b48cff"
        stroke="#7a52c9"
        strokeWidth="2"
      />
      <circle cx="26" cy="36" r="6" fill="#fff" opacity="0.8" />
      <circle cx="74" cy="36" r="6" fill="#fff" opacity="0.8" />
    </g>
    <rect x="46" y="38" width="8" height="38" rx="4" fill="#3a2a40" />
    <circle cx="50" cy="36" r="7" fill="#3a2a40" />
    <path
      d="M47 31 Q40 18 34 16 M53 31 Q60 18 66 16"
      stroke="#3a2a40"
      strokeWidth="2.4"
      fill="none"
      strokeLinecap="round"
    />
    <circle cx="48" cy="35" r="1.4" fill="#fff" />
    <circle cx="52" cy="35" r="1.4" fill="#fff" />
  </>
);

const HEDGEHOG = (
  <>
    <ellipse cx="50" cy="92" rx="36" ry="4" fill="#0000001f" />
    <path
      d="M10 86 L8 70 L16 66 L12 52 L22 50 L22 36 L34 38 L38 24 L48 30 L56 20 L64 30 L74 24 L76 38 L86 40 L84 54 L92 60 L88 72 L92 86 Z"
      fill="#7a5a3c"
      stroke="#523a24"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <path
      d="M10 86 Q8 56 36 52 Q58 52 62 70 Q74 70 88 78 L90 88 Z"
      fill="#f0d3a8"
      stroke={OUTLINE}
    />
    <circle cx="42" cy="68" r="4" fill="#2a1a10" />
    <circle cx="43.4" cy="66.6" r="1.4" fill="#fff" />
    <circle cx="14" cy="80" r="5" fill="#2a1a10" />
    <path
      d="M24 78 q5 5 10 0"
      stroke="#a9805a"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
    />
    <circle cx="34" cy="76" r="4" fill="#ff9aa8" opacity="0.6" />
    <path
      d="M30 90 l-2 5 M60 90 l2 5"
      stroke="#523a24"
      strokeWidth="4"
      strokeLinecap="round"
    />
  </>
);

const VISITOR_ART: Record<VisitorId, React.ReactNode> = {
  owl: OWL,
  snail: SNAIL,
  frog: FROG,
  butterfly: BUTTERFLY,
  hedgehog: HEDGEHOG,
};

export function VisitorArt({ id, className }: ArtProps & { id: VisitorId }) {
  return <Svg className={className}>{VISITOR_ART[id]}</Svg>;
}

export function CloudArt({ className }: ArtProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 160 70"
      className={className}
    >
      <path
        d="M30 62 Q6 62 8 42 Q10 26 30 28 Q34 8 62 10 Q82 0 100 16 Q128 8 136 34 Q156 36 152 52 Q148 64 128 62 Z"
        fill="#c9d3e6"
        stroke="#8a97b3"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M44 40 q4 4 8 0 M104 40 q4 4 8 0"
        stroke="#5a6684"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M72 46 q6 5 12 0"
        stroke="#5a6684"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function DropArt({ className }: ArtProps) {
  return (
    <Svg className={className}>
      <path
        d="M50 8 Q82 46 80 64 Q78 90 50 90 Q22 90 20 64 Q18 46 50 8 Z"
        fill="#5ab4ff"
        stroke="#2f86d6"
        strokeWidth="4"
      />
      <ellipse cx="38" cy="62" rx="6" ry="10" fill="#fff" opacity="0.7" />
      <circle cx="42" cy="74" r="3" fill="#2f5f9a" />
      <circle cx="58" cy="74" r="3" fill="#2f5f9a" />
    </Svg>
  );
}

/** A glowing X that marks the treasure. */
export function MarkArt({ className }: ArtProps) {
  return (
    <Svg className={className}>
      <ellipse cx="50" cy="62" rx="40" ry="16" fill="#6b4a2a" opacity="0.55" />
      <path
        d="M24 30 L76 82 M76 30 L24 82"
        stroke="#fff6c8"
        strokeWidth="18"
        strokeLinecap="round"
        opacity="0.5"
      />
      <path
        d="M24 30 L76 82 M76 30 L24 82"
        stroke="#d8334a"
        strokeWidth="12"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function ChestArt({
  className,
  open = false,
}: ArtProps & { open?: boolean }) {
  return (
    <Svg className={className}>
      <ellipse cx="50" cy="92" rx="36" ry="5" fill="#0000001f" />
      {open ? (
        <>
          <path
            d="M16 50 L24 12 Q50 6 76 12 L84 50 Z"
            fill="#8a4f1c"
            stroke="#6b3f14"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path d="M16 50 L84 50 L80 40 Q50 30 20 40 Z" fill="#ffe28a" />
          <circle
            cx="36"
            cy="40"
            r="6"
            fill="#ffc928"
            stroke="#b57d00"
            strokeWidth="2"
          />
          <circle
            cx="54"
            cy="35"
            r="6"
            fill="#ffc928"
            stroke="#b57d00"
            strokeWidth="2"
          />
          <circle
            cx="68"
            cy="41"
            r="5"
            fill="#ffc928"
            stroke="#b57d00"
            strokeWidth="2"
          />
        </>
      ) : (
        <>
          <path
            d="M14 48 Q14 22 50 22 Q86 22 86 48 Z"
            fill="#c07a34"
            stroke="#6b3f14"
            strokeWidth="3"
          />
          <path d="M14 40 H86" stroke="#6b3f14" strokeWidth="3" />
        </>
      )}
      <rect
        x="14"
        y="48"
        width="72"
        height="40"
        rx="6"
        fill="#a8672a"
        stroke="#6b3f14"
        strokeWidth="3"
      />
      <path d="M14 62 H86" stroke="#6b3f14" strokeWidth="3" />
      <rect
        x="43"
        y="52"
        width="14"
        height="16"
        rx="3"
        fill="#ffc928"
        stroke="#b57d00"
        strokeWidth="2"
      />
      <circle cx="50" cy="60" r="2.4" fill="#6b3f14" />
    </Svg>
  );
}

export function StarArt({ className }: ArtProps) {
  return (
    <Svg className={className}>
      <path
        d="M50 6 L61 36 L94 38 L68 58 L77 90 L50 72 L23 90 L32 58 L6 38 L39 36 Z"
        fill="#ffe066"
        stroke="#e0a800"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <circle cx="42" cy="48" r="3.4" fill="#5a3a10" />
      <circle cx="58" cy="48" r="3.4" fill="#5a3a10" />
      <path
        d="M43 58 q7 7 14 0"
        stroke="#5a3a10"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
}

const MUSHROOM_CAPS = ["#e5484d", "#ff9b3d", "#b48cff", "#4ad0ff", "#ff7ab6"];

export function MushroomArt({
  index,
  className,
}: ArtProps & { index: number }) {
  const cap = MUSHROOM_CAPS[index % MUSHROOM_CAPS.length];
  return (
    <Svg className={className}>
      <ellipse cx="50" cy="90" rx="30" ry="5" fill="#0000001f" />
      <path
        d="M36 52 H64 L68 88 Q50 96 32 88 Z"
        fill="#f6ead2"
        stroke={OUTLINE}
        strokeWidth="2"
      />
      <path
        d="M8 56 Q10 12 50 10 Q90 12 92 56 Q50 66 8 56 Z"
        fill={cap}
        stroke={OUTLINE}
        strokeWidth="2"
      />
      <circle cx="30" cy="34" r="6" fill="#fff" opacity="0.9" />
      <circle cx="56" cy="24" r="5" fill="#fff" opacity="0.9" />
      <circle cx="72" cy="42" r="6" fill="#fff" opacity="0.9" />
      <circle cx="44" cy="74" r="2.4" fill="#2a1a10" />
      <circle cx="56" cy="74" r="2.4" fill="#2a1a10" />
      <path
        d="M46 80 q4 3 8 0"
        stroke="#2a1a10"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function CakeArt({
  className,
  lit = true,
}: ArtProps & { lit?: boolean }) {
  return (
    <Svg className={className}>
      <ellipse cx="50" cy="92" rx="40" ry="5" fill="#0000001f" />
      <rect
        x="12"
        y="58"
        width="76"
        height="32"
        rx="8"
        fill="#ffd7a8"
        stroke="#c98a50"
        strokeWidth="2"
      />
      <rect
        x="20"
        y="36"
        width="60"
        height="28"
        rx="8"
        fill="#ff9ac2"
        stroke="#c9588a"
        strokeWidth="2"
      />
      <path
        d="M20 46 q6 8 12 0 q6 8 12 0 q6 8 12 0 q6 8 12 0 q6 8 12 0"
        stroke="#fff"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="30" cy="72" r="3" fill="#e5484d" />
      <circle cx="50" cy="76" r="3" fill="#4ad0ff" />
      <circle cx="70" cy="72" r="3" fill="#8ee05a" />
      {[34, 50, 66].map((x, i) => (
        <g key={x}>
          <rect
            x={x - 3}
            y="20"
            width="6"
            height="17"
            rx="2"
            fill={["#4ad0ff", "#ffd84a", "#8ee05a"][i]}
          />
          {lit ? (
            <path
              className="fl-candle"
              d={`M${x} 8 Q${x + 6} 14 ${x} 20 Q${x - 6} 14 ${x} 8 Z`}
              fill="#ffb02e"
              stroke="#e8631a"
              strokeWidth="1.4"
            />
          ) : (
            <path
              d={`M${x} 18 q-3 -6 2 -10`}
              stroke="#9aa0ad"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              opacity="0.7"
            />
          )}
        </g>
      ))}
    </Svg>
  );
}

export function PumpkinArt({ className }: ArtProps) {
  return (
    <Svg className={className}>
      <ellipse cx="50" cy="90" rx="36" ry="5" fill="#0000001f" />
      <path d="M46 24 Q44 12 56 8 Q56 18 54 26 Z" fill="#4a8f3a" />
      <ellipse
        cx="30"
        cy="58"
        rx="22"
        ry="30"
        fill="#f08a1a"
        stroke="#b85a08"
        strokeWidth="2"
      />
      <ellipse
        cx="70"
        cy="58"
        rx="22"
        ry="30"
        fill="#f08a1a"
        stroke="#b85a08"
        strokeWidth="2"
      />
      <ellipse
        cx="50"
        cy="58"
        rx="20"
        ry="32"
        fill="#ff9d2e"
        stroke="#b85a08"
        strokeWidth="2"
      />
      <path d="M36 48 L44 56 L30 56 Z M64 48 L72 56 L58 56 Z" fill="#3a1a08" />
      <path d="M36 70 Q50 84 64 70 Q50 76 36 70 Z" fill="#3a1a08" />
    </Svg>
  );
}

export function SnowflakeArt({ className }: ArtProps) {
  return (
    <Svg className={className}>
      <circle cx="50" cy="50" r="44" fill="#2f7fd0" opacity="0.75" />
      <path
        d="M50 14 V86 M19 32 L81 68 M81 32 L19 68"
        stroke="#fff"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <circle cx="50" cy="50" r="8" fill="#fff" />
    </Svg>
  );
}

export function FlowerArt({ className }: ArtProps) {
  return (
    <Svg className={className}>
      <path
        d="M50 56 V92"
        stroke="#3f9f4a"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path d="M50 78 Q34 72 30 60 Q46 60 50 78 Z" fill="#5fbf55" />
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse
          key={a}
          cx="50"
          cy="26"
          rx="11"
          ry="17"
          fill="#ff8fc0"
          stroke="#d6538f"
          strokeWidth="2"
          transform={`rotate(${a} 50 42)`}
        />
      ))}
      <circle
        cx="50"
        cy="42"
        r="10"
        fill="#ffd84a"
        stroke="#c99a00"
        strokeWidth="2"
      />
    </Svg>
  );
}

export function LeafArt({ className }: ArtProps) {
  return (
    <Svg className={className}>
      <path
        d="M50 8 Q92 30 82 66 Q70 90 50 94 Q30 90 18 66 Q8 30 50 8 Z"
        fill="#e8731a"
        stroke="#a8480a"
        strokeWidth="3"
      />
      <path
        d="M50 20 V94 M50 44 L30 34 M50 58 L72 46 M50 72 L32 64"
        stroke="#a8480a"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
}
