import { useState } from "react";
import type { SeasonId } from "@/lib/flamelings/happenings";
import { playSound } from "@/lib/flamelings/sound";
import { useFlamelings } from "@/lib/flamelings/store";
import { FlowerArt, LeafArt, PumpkinArt, SnowflakeArt } from "./HappeningArt";
import { LEFT_SPOT, type HappeningProps } from "./happeningProps";
import { FOCUS_RING } from "./styles";
import { useLater } from "./useLater";

const FALLING: Record<SeasonId, string> = {
  winter: "❄️",
  autumn: "🍂",
  halloween: "🍂",
  spring: "🌸",
};

const TREAT_LABEL: Record<SeasonId, string> = {
  winter: "A snowflake charm. Tap to catch it",
  autumn: "A shiny leaf. Tap to catch it",
  halloween: "A pumpkin treat. Tap to get it",
  spring: "A spring flower. Tap to pick it",
};

const FLAKES = Array.from({ length: 14 }, (_, i) => ({
  x: `${(i * 37 + 5) % 96}%`,
  size: `${1.4 + (i % 4) * 0.45}rem`,
  dur: `${7 + (i % 5)}s`,
  delay: `${-(i * 1.3)}s`,
}));

function Treat({ season }: { season: SeasonId }) {
  const className = "size-full";
  if (season === "winter") return <SnowflakeArt className={className} />;
  if (season === "halloween") return <PumpkinArt className={className} />;
  if (season === "spring") return <FlowerArt className={className} />;
  return <LeafArt className={className} />;
}

/**
 * The season by the real date: flurries, falling leaves or blossom drift over
 * the glade, and a little treat to catch. Late October brings pumpkins.
 */
export default function SeasonHappening({
  petId,
  happening,
  onCheer,
}: HappeningProps) {
  const complete = useFlamelings((s) => s.completeHappening);
  const [wasDone] = useState(happening.done);
  const [phase, setPhase] = useState<"treat" | "caught" | "gone">("treat");
  const later = useLater();
  const season = happening.variant as SeasonId;
  if (wasDone || phase === "gone") return null;

  function grab() {
    if (phase !== "treat") return;
    setPhase("caught");
    playSound("sparkle");
    complete(petId);
    onCheer("sparkle");
    later(() => setPhase("gone"), 3500);
  }

  return (
    <div
      data-testid="happening-season"
      data-season={season}
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {FLAKES.map((flake, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="fl-flake"
          style={
            {
              "--x": flake.x,
              "--size": flake.size,
              "--dur": flake.dur,
              "--delay": flake.delay,
            } as React.CSSProperties
          }
        >
          {FALLING[season]}
        </span>
      ))}
      {season === "halloween" && (
        <>
          <PumpkinArt className="absolute bottom-[19%] left-[1%] size-14" />
          <PumpkinArt className="absolute bottom-[21%] right-[1%] size-16" />
        </>
      )}
      {phase === "treat" && (
        <button
          type="button"
          onClick={grab}
          aria-label={TREAT_LABEL[season] ?? TREAT_LABEL.autumn}
          data-testid="happening-season-treat"
          className={`fl-bob pointer-events-auto absolute ${LEFT_SPOT} grid size-24 place-items-center sm:size-28 ${FOCUS_RING}`}
        >
          <Treat season={season} />
        </button>
      )}
    </div>
  );
}
