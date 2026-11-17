import type { ReactNode } from "react";

export const FL_ICON_NAMES = [
  "home",
  "sound-on",
  "sound-off",
  "feed",
  "play",
  "dress",
  "shop",
  "emotes",
  "friends",
  "back",
  "close",
  "share",
  "spark",
  "fuel",
  "joy",
  "tidy",
  "hat",
  "face",
  "neck",
  "glade",
  "gift",
  "check",
  "lock",
  "plus",
  "dice",
  "camera",
] as const;

export type FlIconName = (typeof FL_ICON_NAMES)[number];

const ROUND = { strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** Multicolour, filled icons on a 24 grid. No stroke is thinner than 1.5. */
const ART: Record<FlIconName, ReactNode> = {
  home: (
    <>
      <path
        d="M3 11 L12 3 L21 11 V20 a1 1 0 0 1 -1 1 H15 V14 H9 V21 H4 a1 1 0 0 1 -1 -1Z"
        fill="#e8795a"
      />
      <rect x="9" y="14" width="6" height="7" fill="#7a3d2c" />
    </>
  ),
  "sound-on": (
    <>
      <path d="M4 9 h4 l5 -4 v14 l-5 -4 H4z" fill="#7a5a78" />
      <path
        d="M16 9 q2 3 0 6 M18.5 7 q4 5 0 10"
        stroke="#7a5a78"
        strokeWidth="2"
        fill="none"
        {...ROUND}
      />
    </>
  ),
  "sound-off": (
    <>
      <path d="M4 9 h4 l5 -4 v14 l-5 -4 H4z" fill="#a58aa3" />
      <path
        d="M16 9 l5 6 M21 9 l-5 6"
        stroke="#a58aa3"
        strokeWidth="2"
        fill="none"
        {...ROUND}
      />
    </>
  ),
  feed: (
    <>
      <rect x="3" y="13" width="18" height="6" rx="3" fill="#8a4a24" />
      <circle cx="6" cy="16" r="2" fill="#d9a06a" />
      <rect x="8" y="5" width="8" height="7" rx="3.5" fill="#fff" />
      <rect x="11.4" y="10" width="1.2" height="5" fill="#a0623a" />
    </>
  ),
  play: (
    <path
      d="M12 12 C 8 4, 2 5, 3 10 C 4 14, 9 13, 12 12 C 15 13, 20 14, 21 10 C 22 5, 16 4, 12 12 Z M12 12 C 9 14, 5 17, 8 20 C 10 21, 12 16, 12 12 C 12 16, 14 21, 16 20 C 19 17, 15 14, 12 12"
      fill="#fff"
    />
  ),
  dress: (
    <>
      <ellipse cx="12" cy="17" rx="10" ry="3" fill="#fff" />
      <path d="M6 17 C 6 8, 18 8, 18 17z" fill="#fff" />
      <rect x="6.5" y="13" width="11" height="2.4" fill="#e8564a" />
    </>
  ),
  shop: (
    <>
      <path
        d="M5 8 h14 l-1 12 a2 2 0 0 1 -2 2 H8 a2 2 0 0 1 -2 -2z"
        fill="#fff"
      />
      <path
        d="M9 8 V6 a3 3 0 0 1 6 0 V8"
        stroke="#fff"
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M12 12 l1 2.4 2.4 .6 -2.4 .8 -1 2.4 -1 -2.4 -2.4 -.8 2.4 -.6z"
        fill="#ffb800"
      />
    </>
  ),
  emotes: (
    <>
      <path
        d="M4 5 h16 a2 2 0 0 1 2 2 v8 a2 2 0 0 1 -2 2 H10 l-5 4 v-4 H4 a2 2 0 0 1 -2 -2 V7 a2 2 0 0 1 2 -2z"
        fill="#fff"
      />
      <circle cx="8" cy="11" r="1.4" fill="#2f9e74" />
      <circle cx="12" cy="11" r="1.4" fill="#2f9e74" />
      <circle cx="16" cy="11" r="1.4" fill="#2f9e74" />
    </>
  ),
  friends: (
    <>
      <path
        d="M8 4 C 10 8, 12 9, 12 13 a4 4 0 0 1 -8 0 c0 -3 2 -5 4 -9z"
        fill="#fff"
      />
      <path
        d="M16 6 C 18 10, 20 11, 20 15 a4 4 0 0 1 -8 0 c0 -3 2 -5 4 -9z"
        fill="#ffe680"
      />
    </>
  ),
  back: (
    <path
      d="M14 5 L7 12 L14 19"
      stroke="#7a5a78"
      strokeWidth="3"
      fill="none"
      {...ROUND}
    />
  ),
  close: (
    <path
      d="M6 6 L18 18 M18 6 L6 18"
      stroke="#7a5a78"
      strokeWidth="3"
      fill="none"
      {...ROUND}
    />
  ),
  share: (
    <>
      <path
        d="M12 3 L12 14"
        stroke="#7a5a78"
        strokeWidth="2.4"
        fill="none"
        {...ROUND}
      />
      <path
        d="M8 7 L12 3 L16 7"
        stroke="#7a5a78"
        strokeWidth="2.4"
        fill="none"
        {...ROUND}
      />
      <path
        d="M6 11 H5 a1 1 0 0 0 -1 1 V20 a1 1 0 0 0 1 1 H19 a1 1 0 0 0 1 -1 V12 a1 1 0 0 0 -1 -1 H18"
        stroke="#7a5a78"
        strokeWidth="2"
        fill="none"
        {...ROUND}
      />
    </>
  ),
  spark: (
    <path
      d="M12 1 l2.6 8.4 L23 12 l-8.4 2.6 L12 23 l-2.6 -8.4 L1 12 l8.4 -2.6z"
      fill="#fff8d6"
      stroke="#b86b00"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  ),
  fuel: (
    <>
      <path
        d="M12 2 C 14 7, 19 9, 19 15 a7 7 0 0 1 -14 0 c0 -4 3 -5 3 -8 c2 2 3 2 4 -5z"
        fill="#ff8a3d"
      />
      <path
        d="M12 11 c1 3 4 4 4 7 a4 4 0 0 1 -8 0 c0 -3 3 -4 4 -7z"
        fill="#ffd166"
      />
    </>
  ),
  joy: (
    <path
      d="M12 21 C 4 15, 2 11, 2 8 a5 5 0 0 1 10 -1 a5 5 0 0 1 10 1 c0 3 -2 7 -10 13z"
      fill="#f43f5e"
    />
  ),
  tidy: (
    <path
      d="M12 2 l2.4 6.6 L21 11 l-6.6 2.4 L12 20 l-2.4 -6.6 L3 11 l6.6 -2.4z"
      fill="#38bdf8"
    />
  ),
  hat: (
    <>
      <ellipse cx="12" cy="17" rx="10" ry="3" fill="#e8795a" />
      <path d="M6 17 C 6 8, 18 8, 18 17z" fill="#f4a261" />
      <rect x="6.5" y="13" width="11" height="2.4" fill="#e8564a" />
    </>
  ),
  face: (
    <>
      <circle cx="12" cy="12" r="10" fill="#ffd166" />
      <circle cx="8.5" cy="10" r="1.6" fill="#3a2340" />
      <circle cx="15.5" cy="10" r="1.6" fill="#3a2340" />
      <path
        d="M7.5 14 q4.5 5 9 0"
        stroke="#3a2340"
        strokeWidth="2"
        fill="none"
        {...ROUND}
      />
    </>
  ),
  neck: (
    <>
      <path d="M3 6 L12 15 L21 6 L21 10 L12 20 L3 10z" fill="#e8564a" />
      <circle cx="12" cy="18" r="3.2" fill="#ffd166" />
    </>
  ),
  glade: (
    <>
      <path d="M12 3 L19 14 H5z" fill="#3f9b6b" />
      <path d="M12 8 L21 20 H3z" fill="#2f7d55" />
      <rect x="10.5" y="19" width="3" height="3" fill="#7a3d2c" />
    </>
  ),
  gift: (
    <>
      <rect x="3" y="9" width="18" height="12" rx="2" fill="#ff8fb1" />
      <rect x="2" y="6" width="20" height="5" rx="1.6" fill="#ff6f9c" />
      <rect x="10.5" y="6" width="3" height="15" fill="#ffd166" />
      <path
        d="M12 6 C 8 1, 4 4, 8 6z M12 6 C 16 1, 20 4, 16 6z"
        fill="#ffd166"
      />
    </>
  ),
  check: (
    <path
      d="M4 12.5 L9.5 18 L20 6.5"
      stroke="#2f9e74"
      strokeWidth="3.4"
      fill="none"
      {...ROUND}
    />
  ),
  lock: (
    <>
      <path
        d="M8 11 V8 a4 4 0 0 1 8 0 V11"
        stroke="#7a5a78"
        strokeWidth="2.4"
        fill="none"
      />
      <rect x="4.5" y="10.5" width="15" height="11" rx="3" fill="#a58aa3" />
      <circle cx="12" cy="15.5" r="1.8" fill="#fff6e6" />
      <rect x="11.2" y="16" width="1.6" height="3" fill="#fff6e6" />
    </>
  ),
  plus: (
    <path
      d="M12 4 V20 M4 12 H20"
      stroke="#fff"
      strokeWidth="3.4"
      fill="none"
      {...ROUND}
    />
  ),
  dice: (
    <>
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="4.5"
        fill="#fff"
        stroke="#b69cff"
        strokeWidth="1.6"
      />
      <circle cx="8.5" cy="8.5" r="1.8" fill="#7a5ac8" />
      <circle cx="15.5" cy="8.5" r="1.8" fill="#7a5ac8" />
      <circle cx="12" cy="12" r="1.8" fill="#7a5ac8" />
      <circle cx="8.5" cy="15.5" r="1.8" fill="#7a5ac8" />
      <circle cx="15.5" cy="15.5" r="1.8" fill="#7a5ac8" />
    </>
  ),
  camera: (
    <>
      <path d="M8 6 L9.5 4 H14.5 L16 6z" fill="#7a5a78" />
      <rect x="2.5" y="6" width="19" height="14" rx="3.5" fill="#7a5a78" />
      <circle cx="12" cy="13" r="4.6" fill="#fff6e6" />
      <circle cx="12" cy="13" r="2.6" fill="#7cc4ff" />
    </>
  ),
};

/** A multicolour storybook icon. Decoration: the button around it is the name. */
export default function FlIcon({
  name,
  className,
}: {
  name: FlIconName;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      className={className}
    >
      {ART[name]}
    </svg>
  );
}
