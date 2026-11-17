import type { FormId } from "@/lib/flamelings/types";

/**
 * The drawing that makes a grown-up form: shapes added to the blob. Decoration
 * only. The look and the motion live in `.fl-` rules in globals.css; an
 * element with `fl-more` only shows once the pet is a Bonfire, which makes
 * every effect stronger.
 */

/** A heart, a four-point star and a crackle, each drawn around (0, 0). */
const HEART = "M0 -1.5 C-2.5 -5 -7 -1 0 5 C7 -1 2.5 -5 0 -1.5Z";
const STAR = "M0 -5 L1.3 -1.3 L5 0 L1.3 1.3 L0 5 L-1.3 1.3 L-5 0 L-1.3 -1.3Z";
const ZAP = "M0 0 L5 -5 L2 -5 L7 -11";

const HEARTS: [number, number, boolean][] = [
  [34, 50, false],
  [88, 46, false],
  [60, 34, false],
  [26, 70, true],
  [96, 66, true],
];
const STARS: [number, number, boolean][] = [
  [24, 42, false],
  [96, 38, false],
  [100, 78, false],
  [20, 74, false],
  [60, 20, true],
  [38, 28, true],
  [84, 24, true],
];
const ZAPS: [number, number, boolean][] = [
  [30, 52, false],
  [92, 50, false],
  [62, 22, false],
  [20, 78, true],
  [100, 72, true],
];

/** Behind the body: the cozy glow. */
export function FormBack({
  form,
  gradientId,
}: {
  form: FormId | null;
  gradientId: string;
}) {
  if (form !== "cozy") return null;
  return (
    <g className="fl-form fl-form-cozy">
      <defs>
        <radialGradient id={gradientId}>
          <stop offset="0.45" stopColor="#ffb040" stopOpacity="0.85" />
          <stop offset="0.75" stopColor="#ff8a3a" stopOpacity="0.4" />
          <stop offset="1" stopColor="#ff8a3a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle
        className="fl-halo"
        cx="60"
        cy="78"
        r="62"
        fill={`url(#${gradientId})`}
      />
    </g>
  );
}

/**
 * Inside the goo filter, so the tips melt into the flame: the wild tips. They
 * are wide at the base on purpose (the filter drops thin shapes).
 */
export function FormTips({ form }: { form: FormId | null }) {
  if (form !== "wild") return null;
  return (
    <g className="fl-form fl-form-wild-tips">
      <path
        className="fl-spike fl-spike-1"
        d="M42 62 Q50 34 60 2 Q70 34 78 62 Z"
      />
      <path
        className="fl-spike fl-spike-2"
        d="M28 70 Q26 40 22 12 Q44 36 54 62 Z"
      />
      <path
        className="fl-spike fl-spike-3"
        d="M92 70 Q94 40 98 12 Q76 36 66 62 Z"
      />
      <path
        className="fl-spike fl-spike-4 fl-more"
        d="M12 94 Q8 66 4 36 Q30 56 40 82 Z"
      />
      <path
        className="fl-spike fl-spike-5 fl-more"
        d="M108 94 Q112 66 116 36 Q90 56 80 82 Z"
      />
    </g>
  );
}

/** In front of the body: blush, brows and the particles. */
export function FormFront({ form }: { form: FormId | null }) {
  if (form === "cozy") {
    return (
      <g className="fl-form fl-form-cozy">
        <ellipse className="fl-blush" cx="42" cy="84" rx="6" ry="3.4" />
        <ellipse className="fl-blush" cx="78" cy="84" rx="6" ry="3.4" />
        {HEARTS.map(([x, y, more], i) => (
          <g key={i} transform={`translate(${x} ${y})`}>
            <path
              className={`fl-heart fl-heart-${i % 3}${more ? " fl-more" : ""}`}
              d={HEART}
            />
          </g>
        ))}
      </g>
    );
  }
  if (form === "wild") {
    return (
      <g className="fl-form fl-form-wild">
        <path className="fl-wild-brow" d="M40 64 L57 70" />
        <path className="fl-wild-brow" d="M80 64 L63 70" />
        {ZAPS.map(([x, y, more], i) => (
          <g key={i} transform={`translate(${x} ${y})`}>
            <path
              className={`fl-zap fl-zap-${i % 3}${more ? " fl-more" : ""}`}
              d={ZAP}
            />
          </g>
        ))}
      </g>
    );
  }
  if (form === "sparkly") {
    return (
      <g className="fl-form fl-form-sparkly">
        {STARS.map(([x, y, more], i) => (
          <g key={i} transform={`translate(${x} ${y})`}>
            <path
              className={`fl-star fl-star-${i % 4}${more ? " fl-more" : ""}`}
              d={STAR}
            />
          </g>
        ))}
      </g>
    );
  }
  return null;
}
