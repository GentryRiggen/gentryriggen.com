import type { Particles } from "@/lib/ever-onward/season";
import type { SkyPhase, Weather, WeatherKind } from "@/lib/ever-onward/sky";

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

/** Sky gradients, one layer each so a change of phase can cross-fade. */
const PHASE_GRADIENTS: Record<SkyPhase, string> = {
  night: "from-[#02030a] via-[#0b1233] to-[#1b1236]",
  dawn: "from-[#2b2a6b] via-[#c0577d] to-[#fbb872]",
  day: "from-[#1f5fae] via-[#4a96d8] to-[#a9d8f5]",
  dusk: "from-[#1a1a4e] via-[#8a3a7a] to-[#f08a4b]",
};

const STAR_OPACITY: Record<SkyPhase, string> = {
  night: "opacity-100",
  dawn: "opacity-30",
  dusk: "opacity-40",
  day: "opacity-0",
};

/** How much weather hides the stars, sun and moon. */
const SKY_VISIBILITY: Record<WeatherKind, number> = {
  clear: 1,
  cloudy: 0.5,
  fog: 0.3,
  rain: 0,
  thunder: 0,
  snow: 0,
};

/** A grey wash over the sky for overcast weather. */
const OVERCAST: Record<WeatherKind, string> = {
  clear: "opacity-0",
  cloudy: "opacity-25",
  fog: "opacity-30",
  rain: "opacity-45",
  thunder: "opacity-55",
  snow: "opacity-30",
};

const SUN_POSITION: Record<SkyPhase, string> = {
  dawn: "left-[14%] top-[34%] bg-orange-200",
  day: "left-[78%] top-[2%] bg-yellow-200",
  dusk: "left-[78%] top-[36%] bg-orange-300",
  night: "left-[78%] top-[2%] bg-orange-200",
};

const SUN_GLOW: Record<SkyPhase, string> = {
  dawn: "shadow-[0_0_40px_14px_rgba(253,186,116,0.55)]",
  day: "shadow-[0_0_64px_24px_rgba(254,240,138,0.6)]",
  dusk: "shadow-[0_0_44px_16px_rgba(251,146,60,0.55)]",
  night: "shadow-none",
};

function visibilityClass(amount: number): string {
  if (amount >= 1) return "opacity-100";
  if (amount >= 0.5) return "opacity-50";
  if (amount > 0) return "opacity-30";
  return "opacity-0";
}

const RAIN_STREAKS = [
  "left-[3%]",
  "left-[8%]",
  "left-[13%]",
  "left-[19%]",
  "left-[24%]",
  "left-[30%]",
  "left-[35%]",
  "left-[41%]",
  "left-[46%]",
  "left-[52%]",
  "left-[57%]",
  "left-[63%]",
  "left-[68%]",
  "left-[73%]",
  "left-[79%]",
  "left-[84%]",
  "left-[90%]",
  "left-[95%]",
  "left-[11%]",
  "left-[27%]",
  "left-[49%]",
  "left-[66%]",
  "left-[82%]",
  "left-[98%]",
  "left-[1%]",
  "left-[16%]",
  "left-[33%]",
  "left-[44%]",
  "left-[55%]",
  "left-[60%]",
  "left-[71%]",
  "left-[76%]",
  "left-[87%]",
  "left-[93%]",
  "left-[38%]",
  "left-[21%]",
];

const STAGGERS = [
  "eo-d0",
  "eo-d5",
  "eo-d2",
  "eo-d9",
  "eo-d4",
  "eo-d12",
  "eo-d1",
  "eo-d7",
  "eo-d10",
  "eo-d3",
  "eo-d14",
  "eo-d6",
];

const CLOUDS = [
  { place: "top-[7%] eo-cloud-a", scale: "scale-100" },
  { place: "top-[19%] eo-cloud-b", scale: "scale-125" },
  { place: "top-[31%] eo-cloud-c", scale: "scale-90" },
  { place: "top-[12%] eo-cloud-d", scale: "scale-110" },
];

function cloudColor(phase: SkyPhase, kind: WeatherKind): string {
  const isStormy = kind === "rain" || kind === "thunder";
  if (phase === "night")
    return isStormy ? "bg-slate-700/80" : "bg-slate-500/60";
  if (isStormy) return "bg-slate-400/90";
  return kind === "snow" ? "bg-slate-200/85" : "bg-white/85";
}

function Cloud({
  place,
  scale,
  color,
}: {
  place: string;
  scale: string;
  color: string;
}) {
  return (
    <div className={`absolute left-0 ${place}`}>
      <div className={`relative h-7 w-28 ${scale}`}>
        <span className={`absolute bottom-0 h-5 w-28 rounded-full ${color}`} />
        <span
          className={`absolute bottom-2 left-4 h-7 w-12 rounded-full ${color}`}
        />
        <span
          className={`absolute bottom-2 left-12 h-6 w-10 rounded-full ${color}`}
        />
      </div>
    </div>
  );
}

function WeatherEffects({
  phase,
  weather,
}: {
  phase: SkyPhase;
  weather: Weather;
}) {
  const { kind, heat } = weather;
  const hasClouds =
    kind === "cloudy" ||
    kind === "rain" ||
    kind === "thunder" ||
    kind === "snow";
  const cloudCount = kind === "cloudy" ? 4 : kind === "snow" ? 3 : 4;
  return (
    <div
      data-testid="eo-weather"
      data-weather={kind}
      data-heat={heat}
      className="eo-fade-in absolute inset-0"
    >
      {hasClouds &&
        CLOUDS.slice(0, cloudCount).map((cloud) => (
          <Cloud key={cloud.place} {...cloud} color={cloudColor(phase, kind)} />
        ))}
      {kind === "fog" && (
        <>
          <div className="absolute inset-0 bg-slate-200/15" />
          <div className="eo-fog absolute inset-x-[-20%] top-[26%] h-24 bg-slate-100/25 blur-2xl" />
          <div className="eo-fog eo-fog-b absolute inset-x-[-20%] top-[50%] h-28 bg-slate-100/25 blur-2xl" />
          <div className="eo-fog absolute inset-x-[-20%] top-[74%] h-24 bg-slate-100/20 blur-2xl" />
        </>
      )}
      {(kind === "rain" || kind === "thunder") &&
        RAIN_STREAKS.map((left, index) => (
          <span
            key={left}
            className={`eo-rain absolute top-0 h-4 w-0.5 rotate-[12deg] bg-sky-100/60 ${left} ${STAGGERS[index % STAGGERS.length]}`}
          />
        ))}
      {kind === "thunder" && (
        <div className="eo-flash absolute inset-0 bg-white" />
      )}
      {heat === "hot" && (
        <>
          <div className="absolute inset-0 bg-linear-to-t from-orange-400/50 via-orange-300/15 to-transparent" />
          <div className="eo-shimmer absolute inset-x-0 bottom-0 h-2/5 bg-[repeating-linear-gradient(to_bottom,rgba(255,214,150,0.16)_0,rgba(255,214,150,0.16)_2px,transparent_2px,transparent_7px)]" />
        </>
      )}
      {heat === "cold" && (
        <div className="absolute inset-0 bg-cyan-100/5 shadow-[inset_0_0_70px_16px_rgba(186,230,253,0.3)]" />
      )}
    </div>
  );
}

interface SkyProps {
  particles: Particles;
  phase: SkyPhase;
  weather: Weather;
}

/**
 * The sky behind everything: a gradient for the time of day, stars, a sun or
 * moon, weather, and the season's drifting bits.
 */
export default function Sky({ particles, phase, weather }: SkyProps) {
  // Weather snow or rain stands in for the season's own drifting bits.
  const effective: Particles =
    weather.kind === "snow"
      ? "snow"
      : weather.kind === "rain" || weather.kind === "thunder"
        ? "none"
        : particles;
  const look = effective === "none" ? null : PARTICLE_LOOKS[effective];
  const visibility = visibilityClass(SKY_VISIBILITY[weather.kind]);
  const isNight = phase === "night";
  return (
    <div
      aria-hidden="true"
      data-testid="eo-sky"
      data-phase={phase}
      className="pointer-events-none absolute inset-0 overflow-hidden bg-[#02030a]"
    >
      {(Object.keys(PHASE_GRADIENTS) as SkyPhase[]).map((id) => (
        <div
          key={id}
          className={`absolute inset-0 bg-linear-to-b transition-opacity duration-[2000ms] ${PHASE_GRADIENTS[id]} ${id === phase ? "opacity-100" : "opacity-0"}`}
        />
      ))}
      <div
        className={`absolute inset-0 transition-opacity duration-[2000ms] ${STAR_OPACITY[phase]}`}
      >
        <div className={`absolute inset-0 ${visibility}`}>
          {STARS.map((star) => (
            <span
              key={star}
              className={`eo-twinkle absolute bg-amber-100 ${star}`}
            />
          ))}
        </div>
      </div>
      <div
        className={`absolute inset-0 transition-opacity duration-[2000ms] ${visibility}`}
      >
        <span
          className={`absolute size-14 rounded-full transition-all duration-[2000ms] ${SUN_POSITION[phase]} ${SUN_GLOW[phase]} ${isNight ? "opacity-0" : "opacity-100"}`}
        />
        <span
          className={`absolute left-[78%] top-[2%] size-12 rounded-full bg-slate-100 shadow-[inset_-9px_-3px_0_0_rgba(148,163,184,0.75),0_0_28px_8px_rgba(226,232,240,0.3)] transition-opacity duration-[2000ms] ${isNight ? "opacity-100" : "opacity-0"}`}
        />
      </div>
      <div
        className={`absolute inset-0 bg-slate-800 transition-opacity duration-[2000ms] ${OVERCAST[weather.kind]}`}
      />
      <WeatherEffects
        key={`${weather.kind}-${weather.heat}`}
        phase={phase}
        weather={weather}
      />
      {look &&
        BITS.map((bit, index) => (
          <span
            key={bit.position}
            className={`absolute ${effective === "fireflies" ? bit.hover : look.top} ${look.size} ${look.motion} ${bit.stagger} ${bit.position} ${look.colors[index % look.colors.length]}`}
          />
        ))}
    </div>
  );
}
