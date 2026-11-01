import type { Particles } from "@/lib/ever-onward/season";

/** Star positions, size and twinkle step; fixed so the sky is the same each visit. */
const STARS = [
  "left-[6%] top-[5%] size-1 eo-d0",
  "left-[17%] top-[12%] size-0.5 eo-d3",
  "left-[28%] top-[4%] size-0.5 eo-d5",
  "left-[39%] top-[9%] size-1 eo-d1",
  "left-[52%] top-[3%] size-0.5 eo-d6",
  "left-[63%] top-[11%] size-1 eo-d2",
  "left-[74%] top-[5%] size-0.5 eo-d4",
  "left-[85%] top-[10%] size-1 eo-d7",
  "left-[94%] top-[4%] size-0.5 eo-d1",
  "left-[10%] top-[22%] size-0.5 eo-d6",
  "left-[22%] top-[27%] size-1 eo-d2",
  "left-[46%] top-[19%] size-0.5 eo-d7",
  "left-[58%] top-[25%] size-0.5 eo-d0",
  "left-[80%] top-[21%] size-1 eo-d5",
  "left-[91%] top-[28%] size-0.5 eo-d3",
  "left-[4%] top-[38%] size-0.5 eo-d4",
  "left-[96%] top-[40%] size-1 eo-d6",
  "left-[14%] top-[58%] size-0.5 eo-d1",
  "left-[88%] top-[62%] size-0.5 eo-d7",
  "left-[7%] top-[78%] size-1 eo-d3",
  "left-[93%] top-[82%] size-0.5 eo-d2",
];

interface Bit {
  position: string;
  /** Where floating bits hover (falling bits start at the top). */
  hover: string;
  stagger: string;
}

/** Where drifting bits start; they fall or float from here. */
const BITS: readonly Bit[] = [
  { position: "left-[8%]", stagger: "eo-d0", hover: "top-[58%]" },
  { position: "left-[19%]", stagger: "eo-d3", hover: "top-[70%]" },
  { position: "left-[31%]", stagger: "eo-d6", hover: "top-[50%]" },
  { position: "left-[44%]", stagger: "eo-d1", hover: "top-[76%]" },
  { position: "left-[57%]", stagger: "eo-d4", hover: "top-[62%]" },
  { position: "left-[69%]", stagger: "eo-d7", hover: "top-[54%]" },
  { position: "left-[81%]", stagger: "eo-d2", hover: "top-[72%]" },
  { position: "left-[92%]", stagger: "eo-d5", hover: "top-[66%]" },
  { position: "left-[13%]", stagger: "eo-d4", hover: "top-[46%]" },
  { position: "left-[37%]", stagger: "eo-d0", hover: "top-[80%]" },
  { position: "left-[63%]", stagger: "eo-d3", hover: "top-[56%]" },
  { position: "left-[75%]", stagger: "eo-d6", hover: "top-[74%]" },
];

/** Looks per kind of particle: how it moves, its size and colors. */
const PARTICLE_LOOKS: Record<
  Exclude<Particles, "none">,
  { motion: string; size: string; colors: readonly string[]; top: string }
> = {
  leaves: {
    motion: "eo-fall",
    size: "size-1.5",
    colors: ["bg-orange-500", "bg-amber-600", "bg-red-500"],
    top: "top-0",
  },
  snow: {
    motion: "eo-fall",
    size: "size-1",
    colors: ["bg-sky-100", "bg-white"],
    top: "top-0",
  },
  blossoms: {
    motion: "eo-fall",
    size: "size-1.5",
    colors: ["bg-pink-300", "bg-pink-200", "bg-rose-300"],
    top: "top-0",
  },
  fireflies: {
    motion: "eo-drift",
    size: "size-1",
    colors: [
      "bg-yellow-200 shadow-[0_0_8px_3px_rgba(253,224,71,0.7)]",
      "bg-lime-200 shadow-[0_0_8px_3px_rgba(190,242,100,0.6)]",
    ],
    top: "",
  },
};

interface SkyProps {
  particles: Particles;
}

/** Twinkling stars plus the season's drifting bits, behind everything. */
export default function Sky({ particles }: SkyProps) {
  const look = particles === "none" ? null : PARTICLE_LOOKS[particles];
  return (
    <div
      aria-hidden="true"
      data-testid="eo-sky"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {STARS.map((star) => (
        <span
          key={star}
          className={`eo-twinkle absolute bg-amber-100 ${star}`}
        />
      ))}
      {look &&
        BITS.map((bit, index) => (
          <span
            key={bit.position}
            className={`absolute ${particles === "fireflies" ? bit.hover : look.top} ${look.size} ${look.motion} ${bit.stagger} ${bit.position} ${look.colors[index % look.colors.length]}`}
          />
        ))}
    </div>
  );
}
