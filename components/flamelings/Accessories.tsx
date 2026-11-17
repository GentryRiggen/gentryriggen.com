import type { FaceId, HatId, NeckId } from "@/lib/flamelings/catalog";

/**
 * Accessories are plain SVG groups in the blob's 120x120 box. Hats sit on the
 * peak (around y 44), faces on the eyes (y 76), necks under the mouth.
 */

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
};

interface AccessoriesProps {
  hat: HatId | null;
  face: FaceId | null;
  neck: NeckId | null;
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
    kind === "hat"
      ? "26 0 68 52"
      : kind === "face"
        ? "34 62 52 32"
        : "28 86 64 40";
  return (
    <svg
      aria-hidden="true"
      viewBox={box}
      className={className}
      focusable="false"
    >
      {art}
    </svg>
  );
}
