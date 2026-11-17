import type {
  Happening,
  SeasonId,
  VisitorId,
} from "@/lib/flamelings/happenings";
import { SAFE_INSETS } from "@/lib/game-kit/safeArea";
import {
  CakeArt,
  ChestArt,
  CloudArt,
  DropArt,
  FlowerArt,
  LeafArt,
  MarkArt,
  MushroomArt,
  PumpkinArt,
  SnowflakeArt,
  StarArt,
  VisitorArt,
} from "./HappeningArt";
import { DIALOG_BACKDROP, PRIMARY_BUTTON, SPOTLIGHT, STICKER } from "./styles";

function Picture({ happening }: { happening: Happening }) {
  const big = "size-32 sm:size-40";
  switch (happening.kind) {
    case "visitor":
      return <VisitorArt id={happening.variant as VisitorId} className={big} />;
    case "rain":
      return (
        <div className="flex flex-col items-center">
          <CloudArt className="w-44" />
          <div className="-mt-1 flex gap-3">
            <DropArt className="fl-bob size-10" />
            <DropArt className="fl-bob size-10 [animation-delay:0.3s]" />
            <DropArt className="fl-bob size-10 [animation-delay:0.6s]" />
          </div>
        </div>
      );
    case "treasure":
      return (
        <div className="flex items-center gap-2">
          <MarkArt className="fl-mark-glow size-24" />
          <ChestArt className="size-24" />
        </div>
      );
    case "star":
      return <StarArt className={`fl-bob ${big}`} />;
    case "mushrooms":
      return (
        <div className="flex gap-1">
          {[0, 2, 4].map((i) => (
            <MushroomArt key={i} index={i} className="size-20" />
          ))}
        </div>
      );
    case "hatchday":
      return <CakeArt className={big} />;
    case "season": {
      const season = happening.variant as SeasonId;
      return season === "winter" ? (
        <SnowflakeArt className={big} />
      ) : season === "spring" ? (
        <FlowerArt className={big} />
      ) : season === "halloween" ? (
        <PumpkinArt className={big} />
      ) : (
        <LeafArt className={big} />
      );
    }
  }
}

/** The short, picture-first "something is here!" card. No reading needed. */
export default function HappeningIntro({
  happening,
  onGo,
}: {
  happening: Happening;
  onGo: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Something is happening!"
      data-testid="happening-intro"
      className={`fixed inset-0 z-30 grid place-items-center p-5 ${DIALOG_BACKDROP} ${SAFE_INSETS}`}
    >
      <div
        className={`${STICKER} fl-pop-in relative flex w-[calc(100%-2rem)] max-w-sm flex-col items-center gap-4 px-6 pb-6 pt-9 text-center`}
      >
        <span
          aria-hidden="true"
          className="fl-bob absolute -top-7 grid size-14 place-items-center rounded-full border-4 border-[#fff6e6] bg-gradient-to-b from-[#ff6b5a] to-[#e0352b] text-4xl font-black text-white shadow-[0_4px_0_#a8231b]"
        >
          !
        </span>
        <div
          className={`grid min-h-40 w-full place-items-center rounded-[24px] ${SPOTLIGHT}`}
        >
          <Picture happening={happening} />
        </div>
        <button
          type="button"
          autoFocus
          onClick={onGo}
          data-testid="happening-go"
          className={PRIMARY_BUTTON}
        >
          <span aria-hidden="true">👀 </span>Look!
        </button>
      </div>
    </div>
  );
}
