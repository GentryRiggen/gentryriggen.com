import { playSound } from "@/lib/flamelings/sound";
import { useFlamelings } from "@/lib/flamelings/store";
import { StarArt } from "./HappeningArt";
import { FOCUS_RING } from "./styles";

/** In the morning, the sparks a night-time wish brought are ready to take. */
export default function WishCollect({ petId }: { petId: string }) {
  const collect = useFlamelings((s) => s.collectWish);
  return (
    <button
      type="button"
      onClick={() => {
        playSound("sparkle");
        collect(petId);
      }}
      aria-label="Your wish came true! Tap to get your sparks"
      data-testid="wish-collect"
      className={`fl-bob pointer-events-auto absolute left-[3%] top-[40%] grid size-20 place-items-center rounded-full bg-indigo-950/60 ${FOCUS_RING}`}
    >
      <StarArt className="size-14 drop-shadow-[0_0_10px_rgba(255,224,102,0.9)]" />
    </button>
  );
}
