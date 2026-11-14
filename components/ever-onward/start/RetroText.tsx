import { Press_Start_2P } from "next/font/google";

/** The arcade pixel font, self-hosted by Next at build time. */
const pixelFont = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

/** Stagger classes (see globals.css); letters past the list reuse the last. */
const DELAY_CLASSES = [
  "eo-d0",
  "eo-d1",
  "eo-d2",
  "eo-d3",
  "eo-d4",
  "eo-d5",
  "eo-d6",
  "eo-d7",
  "eo-d8",
  "eo-d9",
  "eo-d10",
  "eo-d11",
  "eo-d12",
  "eo-d13",
  "eo-d14",
  "eo-d15",
];

interface RetroTextProps {
  text: string;
  /** Size, color, shadow and glow. */
  className?: string;
  /** Pops each letter in, one after the other, starting at this step. */
  popFrom?: number;
}

/**
 * Decorative pixel-font text. Callers give assistive tech a real label, so
 * this is hidden from it.
 */
export default function RetroText({
  text,
  className = "",
  popFrom,
}: RetroTextProps) {
  return (
    <span
      aria-hidden="true"
      className={`${pixelFont.className} block leading-none whitespace-nowrap ${className}`}
    >
      {popFrom === undefined
        ? text
        : [...text].map((char, index) => (
            <span
              key={`${char}-${index}`}
              className={`eo-pop inline-block ${DELAY_CLASSES[Math.min(popFrom + index, DELAY_CLASSES.length - 1)]}`}
            >
              {char}
            </span>
          ))}
    </span>
  );
}
