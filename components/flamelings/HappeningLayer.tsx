import type { EmoteId } from "@/lib/flamelings/catalog";
import {
  happeningWindowAt,
  isNightWindow,
  wishWaiting,
  type Happening,
} from "@/lib/flamelings/happenings";
import { localDay } from "@/lib/flamelings/progress";
import { isAwake } from "@/lib/flamelings/sim";
import { useFlamelings } from "@/lib/flamelings/store";
import type { Pet } from "@/lib/flamelings/types";
import HappeningIntro from "./HappeningIntro";
import HatchDayHappening from "./HatchDayHappening";
import MushroomHappening from "./MushroomHappening";
import RainHappening from "./RainHappening";
import SeasonHappening from "./SeasonHappening";
import StarHappening from "./StarHappening";
import TreasureHappening from "./TreasureHappening";
import VisitorHappening from "./VisitorHappening";
import WishCollect from "./WishCollect";

/** The happening that belongs on screen now, finished or not (it plays out). */
function shownHappening(pet: Pet, clock: number): Happening | null {
  const h = pet.happening;
  if (!h || pet.state !== "alive") return null;
  const window = happeningWindowAt(clock);
  if (h.window === window) return h;
  const carried =
    h.kind === "hatchday" &&
    h.window.slice(0, 10) === localDay(clock) &&
    !isNightWindow(window);
  return carried ? h : null;
}

interface HappeningLayerProps {
  pet: Pet;
  clock: number;
  /** Something sits on top (a shop, a game): the rain holds still. */
  paused: boolean;
  onCheer: (emote?: EmoteId) => void;
}

/** Everything a happening draws over the glade, plus its intro card. */
export default function HappeningLayer({
  pet,
  clock,
  paused,
  onCheer,
}: HappeningLayerProps) {
  const markSeen = useFlamelings((s) => s.markHappeningSeen);
  const happening = shownHappening(pet, clock);
  const props = { petId: pet.id, onCheer };

  return (
    <>
      {happening && happening.seen && (
        <div
          key={`${happening.kind}-${happening.window}`}
          className="pointer-events-none absolute inset-0"
        >
          {happening.kind === "visitor" && (
            <VisitorHappening {...props} happening={happening} />
          )}
          {happening.kind === "rain" && (
            <RainHappening {...props} happening={happening} paused={paused} />
          )}
          {happening.kind === "treasure" && (
            <TreasureHappening {...props} happening={happening} />
          )}
          {happening.kind === "star" && (
            <StarHappening {...props} happening={happening} />
          )}
          {happening.kind === "mushrooms" && (
            <MushroomHappening {...props} happening={happening} />
          )}
          {happening.kind === "hatchday" && (
            <HatchDayHappening {...props} happening={happening} />
          )}
          {happening.kind === "season" && (
            <SeasonHappening {...props} happening={happening} />
          )}
        </div>
      )}
      {wishWaiting(pet, isAwake(clock)) && <WishCollect petId={pet.id} />}
      {happening && !happening.seen && !happening.done && (
        <HappeningIntro happening={happening} onGo={() => markSeen(pet.id)} />
      )}
    </>
  );
}
