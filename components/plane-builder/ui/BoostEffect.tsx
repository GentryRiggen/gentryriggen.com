/** Angles of the speed lines, degrees, spread round the screen (none dead ahead). */
const LINE_ANGLES = [
  -160, -130, -105, -75, -50, -20, 20, 50, 75, 105, 130, 160,
];

interface BoostEffectProps {
  isActive: boolean;
}

/**
 * While boost is burning fuel: a warm glow round the screen edge and speed
 * lines streaking outward from the middle. Reduced motion keeps only the glow.
 */
export default function BoostEffect({ isActive }: BoostEffectProps) {
  if (!isActive) return null;
  return (
    <div
      aria-hidden="true"
      data-testid="boost-effect"
      className="pointer-events-none absolute inset-0 overflow-hidden shadow-[inset_0_0_80px_20px_rgb(249_115_22/0.45)] dark:shadow-[inset_0_0_80px_20px_rgb(251_146_60/0.4)]"
    >
      {LINE_ANGLES.map((angle, i) => (
        <span
          key={angle}
          className="pb-speed-line absolute left-1/2 top-1/2 h-1 w-[22vmin] origin-left rounded-full bg-gradient-to-r from-transparent to-white motion-reduce:hidden dark:to-orange-100"
          style={
            {
              "--angle": `${angle}deg`,
              animationDelay: `${(i % 4) * 0.12}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
