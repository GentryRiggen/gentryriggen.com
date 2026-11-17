import type { FaceId, HatId, NeckId } from "@/lib/flamelings/catalog";

/**
 * Accessories are plain SVG groups in the blob's 120x120 box. Hats sit on the
 * peak (around y 44), faces on the eyes (y 76), necks under the mouth.
 */

/** Points along the neckline curve (quadratic from 44,92 via 60,112 to 76,92). */
function neckPoints(count: number): [number, number][] {
  return Array.from({ length: count }, (_, i) => {
    const t = (i + 0.5) / count;
    const u = 1 - t;
    return [
      u * u * 44 + 2 * u * t * 60 + t * t * 76,
      u * u * 92 + 2 * u * t * 112 + t * t * 92,
    ];
  });
}
const BEADS = neckPoints(7);
const BEAD_COLOURS = ["#ff7ab6", "#ffd84a", "#4ad0ff", "#a8f04a"];
const LEI = neckPoints(6);
const LEI_COLOURS = ["#ff7ab6", "#ff9b5a", "#ffd84a"];

const HATS_SVG: Record<HatId, React.ReactNode> = {
  party: (
    <>
      <polygon points="60,10 45,45 75,45" fill="#ff5fa2" />
      <polygon points="60,10 53,27 67,27" fill="#ffd84a" />
      <path d="M48 38 L72 38" stroke="#ffd84a" strokeWidth="3" />
      <circle cx="60" cy="10" r="4.5" fill="#fff" />
    </>
  ),
  crown: (
    <>
      <path
        d="M43 46 L43 27 L51 36 L60 22 L69 36 L77 27 L77 46 Z"
        fill="#ffc928"
        stroke="#b57d00"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="60" cy="38" r="3" fill="#e5365a" />
      <circle cx="49" cy="41" r="2" fill="#4aa3ff" />
      <circle cx="71" cy="41" r="2" fill="#4aa3ff" />
    </>
  ),
  wizard: (
    <>
      <path d="M60 4 Q56 26 44 46 L76 46 Q66 24 66 12 Z" fill="#5b3fd1" />
      <ellipse cx="60" cy="46" rx="23" ry="5" fill="#4429a8" />
      <path
        d="M55 30 l1.6 3.4 3.6 .4 -2.7 2.4 .8 3.6 -3.3 -1.9 -3.3 1.9 .8 -3.6 -2.7 -2.4 3.6 -.4z"
        fill="#ffd84a"
        transform="translate(4 -2) scale(.8)"
      />
    </>
  ),
  tophat: (
    <>
      <rect x="46" y="18" width="28" height="27" rx="3" fill="#2b2b33" />
      <rect x="46" y="35" width="28" height="6" fill="#d83a56" />
      <ellipse cx="60" cy="45" rx="21" ry="4.5" fill="#1f1f26" />
    </>
  ),
  beanie: (
    <>
      <path d="M42 46 Q42 22 60 22 Q78 22 78 46 Z" fill="#e8504b" />
      <rect x="41" y="41" width="38" height="7" rx="3.5" fill="#b83b37" />
      <path
        d="M50 30 L50 41 M60 26 L60 41 M70 30 L70 41"
        stroke="#f08a86"
        strokeWidth="1.6"
      />
      <circle cx="60" cy="20" r="5.5" fill="#fff" />
    </>
  ),
  cowboy: (
    <>
      <ellipse cx="60" cy="45" rx="30" ry="6" fill="#9a6a3a" />
      <path
        d="M46 45 Q45 24 55 27 Q60 30 65 27 Q75 24 74 45 Z"
        fill="#b07a45"
      />
      <path d="M47 40 L73 40" stroke="#5a3a1c" strokeWidth="3" />
    </>
  ),
  propeller: (
    <>
      <path d="M44 47 Q44 31 60 31 Q76 31 76 47 Z" fill="#3aa0ff" />
      <path
        d="M60 31 L60 23"
        stroke="#1e6fc2"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M44 40 Q60 36 76 40"
        stroke="#ffd84a"
        strokeWidth="3"
        fill="none"
      />
      <g className="fl-prop">
        <ellipse cx="60" cy="22" rx="15" ry="2.6" fill="#ff5555" />
      </g>
      <circle cx="60" cy="22" r="2" fill="#ffd84a" />
    </>
  ),
  viking: (
    <>
      <path d="M43 46 Q43 26 60 26 Q77 26 77 46 Z" fill="#aab3c0" />
      <rect x="42" y="40" width="36" height="5" rx="2" fill="#7b8696" />
      <path
        d="M44 36 Q31 34 32 18 Q38 28 47 29 Z"
        fill="#f4ecd8"
        stroke="#bfae8a"
        strokeWidth="1"
      />
      <path
        d="M76 36 Q89 34 88 18 Q82 28 73 29 Z"
        fill="#f4ecd8"
        stroke="#bfae8a"
        strokeWidth="1"
      />
    </>
  ),
  flower: (
    <>
      <path
        d="M60 46 Q57 42 60 38"
        stroke="#2e9e3f"
        strokeWidth="2"
        fill="none"
      />
      {[0, 72, 144, 216, 288].map((angle) => (
        <circle
          key={angle}
          cx={60 + 6.5 * Math.cos((angle * Math.PI) / 180)}
          cy={32 + 6.5 * Math.sin((angle * Math.PI) / 180)}
          r="4.6"
          fill="#ff7ab6"
        />
      ))}
      <circle cx="60" cy="32" r="4" fill="#ffd84a" />
    </>
  ),
  pirate: (
    <>
      <path
        d="M32 47 Q38 22 60 24 Q82 22 88 47 Q60 39 32 47 Z"
        fill="#25252f"
        stroke="#0f0f15"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M38 41 Q60 34 82 41"
        stroke="#e0b03a"
        strokeWidth="2.2"
        fill="none"
      />
      <circle cx="60" cy="32" r="4.2" fill="#fff" />
      <path
        d="M56.5 38 L63.5 33 M63.5 38 L56.5 33"
        stroke="#fff"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="58.6" cy="31.4" r="0.9" fill="#25252f" />
      <circle cx="61.4" cy="31.4" r="0.9" fill="#25252f" />
    </>
  ),
  chef: (
    <>
      <circle
        cx="47"
        cy="28"
        r="9"
        fill="#fff"
        stroke="#dfe3ea"
        strokeWidth="1.2"
      />
      <circle
        cx="73"
        cy="28"
        r="9"
        fill="#fff"
        stroke="#dfe3ea"
        strokeWidth="1.2"
      />
      <circle
        cx="60"
        cy="22"
        r="11"
        fill="#fff"
        stroke="#dfe3ea"
        strokeWidth="1.2"
      />
      <rect
        x="45"
        y="30"
        width="30"
        height="16"
        rx="3"
        fill="#fff"
        stroke="#dfe3ea"
        strokeWidth="1.2"
      />
      <rect x="45" y="40" width="30" height="6" rx="2" fill="#eef1f6" />
    </>
  ),
  bunny: (
    <>
      <g transform="rotate(-12 50 44)">
        <ellipse
          cx="50"
          cy="24"
          rx="6.5"
          ry="19"
          fill="#fff"
          stroke="#e3e6ec"
          strokeWidth="1.2"
        />
        <ellipse cx="50" cy="26" rx="3.2" ry="13" fill="#ffb3c8" />
      </g>
      <g transform="rotate(12 70 44)">
        <ellipse
          cx="70"
          cy="24"
          rx="6.5"
          ry="19"
          fill="#fff"
          stroke="#e3e6ec"
          strokeWidth="1.2"
        />
        <ellipse cx="70" cy="26" rx="3.2" ry="13" fill="#ffb3c8" />
      </g>
      <path
        d="M44 47 Q60 38 76 47"
        stroke="#ff8fb3"
        strokeWidth="3.4"
        fill="none"
        strokeLinecap="round"
      />
    </>
  ),
  headphones: (
    <>
      <path
        d="M38 64 Q38 28 60 28 Q82 28 82 64"
        stroke="#2f2f3a"
        strokeWidth="4.4"
        fill="none"
        strokeLinecap="round"
      />
      <rect
        x="31"
        y="56"
        width="12"
        height="20"
        rx="6"
        fill="#ff5f7a"
        stroke="#c42f50"
        strokeWidth="1.4"
      />
      <rect
        x="77"
        y="56"
        width="12"
        height="20"
        rx="6"
        fill="#ff5f7a"
        stroke="#c42f50"
        strokeWidth="1.4"
      />
      <rect x="34" y="61" width="4" height="10" rx="2" fill="#ffb3c2" />
      <rect x="82" y="61" width="4" height="10" rx="2" fill="#ffb3c2" />
    </>
  ),
  astronaut: (
    <>
      <circle
        cx="60"
        cy="64"
        r="38"
        fill="#9fd0ff"
        fillOpacity="0.3"
        stroke="#c9d6e6"
        strokeWidth="5"
      />
      <circle
        cx="60"
        cy="64"
        r="38"
        fill="none"
        stroke="#8aa0bd"
        strokeWidth="1"
      />
      <path
        d="M36 52 Q42 36 58 31"
        stroke="#fff"
        strokeOpacity="0.9"
        strokeWidth="3.4"
        fill="none"
        strokeLinecap="round"
      />
      <rect
        x="40"
        y="96"
        width="40"
        height="9"
        rx="4.5"
        fill="#d3d9e2"
        stroke="#8aa0bd"
        strokeWidth="1.2"
      />
      <circle cx="60" cy="25" r="2.6" fill="#ff6a5f" />
    </>
  ),
  flowerCrown: (
    <>
      <path
        d="M38 48 Q60 32 82 48"
        stroke="#3a9e4a"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
      {[
        [43, 44, "#ff7ab6"],
        [51, 38.5, "#ffd84a"],
        [60, 36, "#fff"],
        [69, 38.5, "#b58cff"],
        [77, 44, "#ff9b5a"],
      ].map(([x, y, c]) => (
        <g key={String(x)}>
          <circle
            cx={x}
            cy={y}
            r="5"
            fill={String(c)}
            stroke="#0000001a"
            strokeWidth="0.8"
          />
          <circle cx={x} cy={y} r="1.8" fill="#fff6a8" />
        </g>
      ))}
    </>
  ),
  partyCrown: (
    <>
      <path
        d="M41 47 L41 29 L50 38 L60 24 L70 38 L79 29 L79 47 Z"
        fill="#ff7ac8"
        stroke="#c43d93"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="41" cy="28" r="3.2" fill="#ffd84a" />
      <circle cx="60" cy="23" r="3.6" fill="#4ad0ff" />
      <circle cx="79" cy="28" r="3.2" fill="#a8f04a" />
      <circle cx="50" cy="43" r="1.8" fill="#fff" />
      <circle cx="60" cy="41" r="1.8" fill="#fff" />
      <circle cx="70" cy="43" r="1.8" fill="#fff" />
    </>
  ),
  witch: (
    <>
      <ellipse cx="60" cy="46" rx="31" ry="6" fill="#2a1f3d" />
      <path
        d="M46 46 Q54 26 59 14 Q63 6 73 9 Q66 13 66 24 Q70 36 74 46 Z"
        fill="#3b2a5a"
      />
      <path
        d="M48 40 Q60 43 73 40"
        stroke="#a24bd6"
        strokeWidth="4.4"
        fill="none"
      />
      <rect x="57" y="37.5" width="7" height="6" rx="1.4" fill="#ffd84a" />
    </>
  ),
};

const FACES_SVG: Record<FaceId, React.ReactNode> = {
  sunglasses: (
    <>
      <rect x="40" y="69" width="19" height="12" rx="5" fill="#1d1d25" />
      <rect x="61" y="69" width="19" height="12" rx="5" fill="#1d1d25" />
      <path d="M59 73 L61 73" stroke="#1d1d25" strokeWidth="2.4" />
      <path
        d="M44 72 L50 72"
        stroke="#fff"
        strokeOpacity="0.55"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M65 72 L71 72"
        stroke="#fff"
        strokeOpacity="0.55"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </>
  ),
  glasses: (
    <>
      <circle
        cx="50"
        cy="76"
        r="9"
        fill="#fff"
        fillOpacity="0.2"
        stroke="#33333d"
        strokeWidth="2"
      />
      <circle
        cx="70"
        cy="76"
        r="9"
        fill="#fff"
        fillOpacity="0.2"
        stroke="#33333d"
        strokeWidth="2"
      />
      <path
        d="M59 75 Q60 73.5 61 75"
        stroke="#33333d"
        strokeWidth="2"
        fill="none"
      />
    </>
  ),
  monocle: (
    <>
      <circle
        cx="70"
        cy="76"
        r="9"
        fill="#fff"
        fillOpacity="0.18"
        stroke="#d9a400"
        strokeWidth="2.2"
      />
      <path
        d="M77 82 Q86 92 80 108"
        stroke="#d9a400"
        strokeWidth="1.4"
        fill="none"
      />
    </>
  ),
  mustache: (
    <path
      d="M47 85 Q53 79 60 84 Q67 79 73 85 Q67 90 60 86 Q53 90 47 85 Z"
      fill="#4a2c17"
    />
  ),
  starCheeks: (
    <>
      {[40, 80].map((x) => (
        <path
          key={x}
          d="M0 -5 L1.5 -1.6 L5 -1.5 L2.3 .8 L3.2 4.3 L0 2.4 L-3.2 4.3 L-2.3 .8 L-5 -1.5 L-1.5 -1.6 Z"
          transform={`translate(${x} 84)`}
          fill="#ff5fa2"
        />
      ))}
    </>
  ),
  heartGlasses: (
    <>
      {[50, 70].map((x) => (
        <g key={x} transform={`translate(${x} 74)`}>
          <path
            d="M0 -2 C-2 -8 -11 -6 -11 0 C-11 5 -3 8 0 12 C3 8 11 5 11 0 C11 -6 2 -8 0 -2 Z"
            fill="#ff4f87"
            fillOpacity="0.8"
            stroke="#c21f5c"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M-6 -1 Q-6 -4 -3 -4"
            stroke="#fff"
            strokeOpacity="0.8"
            strokeWidth="1.6"
            fill="none"
            strokeLinecap="round"
          />
        </g>
      ))}
      <path
        d="M60 73 L60 73"
        stroke="#c21f5c"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </>
  ),
  eyepatch: (
    <>
      <path
        d="M41 68 Q60 56 82 68"
        stroke="#25252f"
        strokeWidth="2"
        fill="none"
      />
      <ellipse
        cx="50"
        cy="76"
        rx="8.5"
        ry="7.5"
        fill="#25252f"
        stroke="#0f0f15"
        strokeWidth="1"
      />
      <path
        d="M45 72 Q48 70 51 71"
        stroke="#fff"
        strokeOpacity="0.3"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
      />
    </>
  ),
  clownNose: (
    <>
      <circle
        cx="60"
        cy="82"
        r="6"
        fill="#ff3b4a"
        stroke="#c4202f"
        strokeWidth="1"
      />
      <circle cx="58" cy="80" r="1.8" fill="#fff" fillOpacity="0.8" />
    </>
  ),
  freckles: (
    <>
      {[
        [43, 83],
        [47.5, 85.5],
        [41, 87],
        [77, 83],
        [72.5, 85.5],
        [79, 87],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.3" fill="#a2542a" />
      ))}
    </>
  ),
};

const NECKS_SVG: Record<NeckId, React.ReactNode> = {
  bowtie: (
    <>
      <path d="M60 99 L46 92 L46 106 Z" fill="#e5365a" />
      <path d="M60 99 L74 92 L74 106 Z" fill="#e5365a" />
      <circle cx="60" cy="99" r="3.4" fill="#b01e3f" />
    </>
  ),
  scarf: (
    <>
      <path d="M36 94 Q60 108 84 94 L86 102 Q60 118 34 102 Z" fill="#3aa0ff" />
      <path d="M72 106 L80 120 L70 118 Z" fill="#2478c9" />
      <path
        d="M44 99 L50 104 M58 103 L62 108 M70 101 L76 98"
        stroke="#fff"
        strokeOpacity="0.6"
        strokeWidth="2"
      />
    </>
  ),
  medal: (
    <>
      <path
        d="M48 92 L60 106 L72 92"
        stroke="#e5365a"
        strokeWidth="3.6"
        fill="none"
      />
      <circle
        cx="60"
        cy="108"
        r="7"
        fill="#ffc928"
        stroke="#b57d00"
        strokeWidth="1.6"
      />
      <path
        d="M60 103.5 l1.5 3 3.3 .4 -2.4 2.2 .6 3.3 -3 -1.6 -3 1.6 .6 -3.3 -2.4 -2.2 3.3 -.4z"
        fill="#b57d00"
      />
    </>
  ),
  necklace: (
    <>
      <path
        d="M44 92 Q60 112 76 92"
        stroke="#e8e8f0"
        strokeWidth="1.6"
        fill="none"
      />
      {BEADS.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r="2.2"
          fill={BEAD_COLOURS[i % BEAD_COLOURS.length]}
        />
      ))}
      <path
        d="M60 108 C58 104 52 105 54 110 C55 113 59 114 60 117 C61 114 65 113 66 110 C68 105 62 104 60 108 Z"
        fill="#ffc928"
        stroke="#b57d00"
        strokeWidth="1.2"
      />
    </>
  ),
  cape: (
    <>
      <path
        d="M41 91 Q60 104 79 91 L81 98 Q60 111 39 98 Z"
        fill="#d8334a"
        stroke="#a8203a"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <circle
        cx="44"
        cy="97"
        r="3.2"
        fill="#ffc928"
        stroke="#b57d00"
        strokeWidth="1.2"
      />
      <circle
        cx="76"
        cy="97"
        r="3.2"
        fill="#ffc928"
        stroke="#b57d00"
        strokeWidth="1.2"
      />
    </>
  ),
  lei: (
    <>
      <path
        d="M44 92 Q60 112 76 92"
        stroke="#3a9e4a"
        strokeWidth="2.4"
        fill="none"
      />
      {LEI.map(([x, y], i) => (
        <g key={i}>
          <circle
            cx={x}
            cy={y}
            r="4.2"
            fill={LEI_COLOURS[i % LEI_COLOURS.length]}
            stroke="#0000001a"
            strokeWidth="0.8"
          />
          <circle cx={x} cy={y} r="1.4" fill="#fff6a8" />
        </g>
      ))}
    </>
  ),
  bandana: (
    <>
      <path
        d="M39 90 Q60 100 81 90 L60 116 Z"
        fill="#1fb5a6"
        stroke="#0f8478"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M40 92 Q60 101 80 92"
        stroke="#0f8478"
        strokeWidth="1.6"
        fill="none"
      />
      <circle cx="54" cy="100" r="1.6" fill="#fff" />
      <circle cx="66" cy="100" r="1.6" fill="#fff" />
      <circle cx="60" cy="107" r="1.6" fill="#fff" />
    </>
  ),
};

interface AccessoriesProps {
  hat: HatId | null;
  face: FaceId | null;
  neck: NeckId | null;
}

/** Drawn behind the body: only the cape's back, for now. */
const BACK_SVG: Partial<Record<NeckId, React.ReactNode>> = {
  cape: (
    <>
      <path
        d="M38 88 Q30 108 22 119 Q60 128 98 119 Q90 108 82 88 Z"
        fill="#d8334a"
        stroke="#a8203a"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M46 98 Q40 110 37 119 Q60 124 83 119 Q80 110 74 98 Z"
        fill="#a8203a"
      />
    </>
  ),
};

/** Worn items that sit behind the flameling (a cape's back). */
export function AccessoriesBack({ neck }: { neck: NeckId | null }) {
  return neck && BACK_SVG[neck] ? (
    <g className="fl-back">{BACK_SVG[neck]}</g>
  ) : null;
}

/** The worn items, to draw inside the blob's `fl-all` group. */
export default function Accessories({ hat, face, neck }: AccessoriesProps) {
  return (
    <>
      {neck && <g className="fl-neck">{NECKS_SVG[neck]}</g>}
      {face && <g className="fl-face">{FACES_SVG[face]}</g>}
      {hat && <g className="fl-hat">{HATS_SVG[hat]}</g>}
    </>
  );
}

/** Items too tall or wide for their kind's usual picture box. */
const BOX_OVERRIDE: Record<string, string> = {
  headphones: "26 24 68 56",
  astronaut: "20 24 80 86",
  bunny: "30 0 60 52",
  pirate: "28 14 64 36",
  cape: "18 84 84 44",
};

/** One item alone, for the Wardrobe picker. */
export function AccessoryIcon({
  kind,
  id,
  className,
}: {
  kind: "hat" | "face" | "neck";
  id: string;
  className?: string;
}) {
  const art =
    kind === "hat"
      ? HATS_SVG[id as HatId]
      : kind === "face"
        ? FACES_SVG[id as FaceId]
        : NECKS_SVG[id as NeckId];
  const box =
    BOX_OVERRIDE[id] ??
    (kind === "hat"
      ? "26 0 68 52"
      : kind === "face"
        ? "34 62 52 32"
        : "28 86 64 40");
  return (
    <svg
      aria-hidden="true"
      viewBox={box}
      className={className}
      focusable="false"
    >
      {kind === "neck" && BACK_SVG[id as NeckId]}
      {art}
    </svg>
  );
}
