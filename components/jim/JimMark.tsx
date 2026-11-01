interface JimMarkProps {
  /** "sm" for the header (28px), "lg" for the welcome screens (56px). */
  size?: "sm" | "lg";
  /** Jim is working: the mark breathes. */
  busy?: boolean;
}

/**
 * Jim's mark: a four-point spark on a warm, lit tile. Decorative; the name
 * beside it (or the heading it sits over) says who it is.
 */
export default function JimMark({ size = "sm", busy = false }: JimMarkProps) {
  const box = size === "lg" ? "size-14 rounded-2xl" : "size-7 rounded-[0.6rem]";
  const icon = size === "lg" ? "size-7" : "size-4";
  return (
    <span
      aria-hidden="true"
      className={`jim-glow inline-flex shrink-0 items-center justify-center text-ayu-bg ${box} ${busy ? "jim-breathe" : ""}`}
    >
      <svg viewBox="0 0 24 24" className={icon} fill="currentColor">
        <path d="M12 2.5c.5 4.9 2.6 7 7.5 7.5v.1c-4.9.5-7 2.6-7.5 7.5h-.1c-.5-4.9-2.6-7-7.5-7.5V10c4.9-.5 7-2.6 7.5-7.5Z" />
        <path
          opacity=".7"
          d="M18.5 15.5c.2 1.9 1 2.8 3 3-2 .2-2.8 1-3 3-.2-2-1.1-2.8-3-3 1.9-.2 2.8-1.1 3-3Z"
        />
      </svg>
    </span>
  );
}
