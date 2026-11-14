import { useId } from "react";

interface JimMarkProps {
  /** "sm" for the header (28px), "lg" for the welcome screens (56px). */
  size?: "sm" | "lg";
  /** Jim is working: the mark breathes. */
  busy?: boolean;
}

/**
 * Jim's mark: the app icon ("Glow Pal"), a glowing chat-bubble pal on midnight
 * with a tiny ringed planet. Same art as public/jim-icons/glow-pal.svg.
 * Decorative; the name beside it (or the heading it sits over) says who it is.
 */
export default function JimMark({ size = "sm", busy = false }: JimMarkProps) {
  // Several marks can be on screen at once, so gradient ids must be unique.
  const id = useId().replace(/:/g, "");
  const box = size === "lg" ? "size-14 rounded-2xl" : "size-7 rounded-[0.6rem]";
  const bubble =
    "M28 26h44a12 12 0 0 1 12 12v18a12 12 0 0 1-12 12H46l-12 10v-10h-6a12 12 0 0 1-12-12V38a12 12 0 0 1 12-12Z";
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 overflow-hidden shadow-[0_8px_24px_-10px_rgb(255_173_102/0.55)] ring-1 ring-white/10 ${box} ${busy ? "jim-breathe" : ""}`}
    >
      <svg viewBox="0 0 100 100" className="size-full">
        <defs>
          <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2b3347" />
            <stop offset="1" stopColor="#171b25" />
          </linearGradient>
          <radialGradient id={`${id}glow`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffcc66" stopOpacity="0.5" />
            <stop offset="1" stopColor="#ffcc66" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${id}pal`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffe9a3" />
            <stop offset="0.55" stopColor="#ffcc66" />
            <stop offset="1" stopColor="#ffad5c" />
          </linearGradient>
          <radialGradient id={`${id}shine`} cx="0.3" cy="0.22" r="0.55">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.45" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="100" height="100" fill={`url(#${id}sky)`} />
        <circle cx="50" cy="54" r="40" fill={`url(#${id}glow)`} />
        <circle cx="20" cy="22" r="1.6" fill="#ffffff" opacity="0.7" />
        <circle cx="84" cy="80" r="1.4" fill="#ffffff" opacity="0.5" />
        <circle cx="17" cy="70" r="1.2" fill="#ffffff" opacity="0.5" />
        <circle cx="34" cy="14" r="1" fill="#ffffff" opacity="0.4" />
        <g transform="translate(12 16) scale(0.76)">
          <path fill={`url(#${id}pal)`} d={bubble} />
          <path fill={`url(#${id}shine)`} d={bubble} />
          <g fill="none" stroke="#1f2430" strokeWidth="4" strokeLinecap="round">
            <path d="M36 45q5-6 10 0" />
            <path d="M54 45q5-6 10 0" />
            <path d="M42 54c4 4 12 4 16 0" />
          </g>
          <circle cx="34" cy="53" r="4" fill="#ff8f6b" opacity="0.6" />
          <circle cx="66" cy="53" r="4" fill="#ff8f6b" opacity="0.6" />
        </g>
        <circle cx="77" cy="25" r="5.6" fill="#73d0ff" />
        <ellipse
          cx="77"
          cy="25"
          rx="9.4"
          ry="2.8"
          fill="none"
          stroke="#dfbfff"
          strokeWidth="1.7"
          transform="rotate(-20 77 25)"
        />
      </svg>
    </span>
  );
}
