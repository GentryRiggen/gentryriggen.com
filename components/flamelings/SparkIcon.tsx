/** The spark: a little gold four-point star, the shop's money. */
export default function SparkIcon({
  className = "size-7",
}: {
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      className={className}
    >
      <path
        d="M12 1.5 L14.8 9.2 L22.5 12 L14.8 14.8 L12 22.5 L9.2 14.8 L1.5 12 L9.2 9.2 Z"
        fill="#ffc928"
        stroke="#c78a00"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M12 5 L13.2 10.8 L12 12 L10.8 10.8 Z"
        fill="#fff3b0"
        opacity="0.85"
      />
    </svg>
  );
}
