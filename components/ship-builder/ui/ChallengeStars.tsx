import { Star } from "lucide-react";

interface ChallengeStarsProps {
  stars: number;
  max?: number;
  className?: string;
}

/** Three stars, filled for those earned. Read aloud as one phrase. */
export default function ChallengeStars({
  stars,
  max = 3,
  className = "h-5 w-5",
}: ChallengeStarsProps) {
  return (
    <span
      role="img"
      aria-label={`${stars} of ${max} stars`}
      className="inline-flex items-center gap-0.5"
    >
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          aria-hidden="true"
          className={`${className} ${
            i < stars
              ? "fill-amber-400 text-amber-500 dark:fill-amber-300 dark:text-amber-300"
              : "text-slate-300 dark:text-slate-600"
          }`}
        />
      ))}
    </span>
  );
}
