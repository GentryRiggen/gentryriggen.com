import { useEffect } from "react";
import type { EmoteId } from "@/lib/flamelings/catalog";
import {
  currentHappening,
  wishWaiting,
  type Happening,
} from "@/lib/flamelings/happenings";
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
  const hold = useFlamelings((s) => s.hold);
  const holding = useFlamelings((s) => s.holding);
  const stored = pet.happening;
  const heldOnScreen =
    holding && holding.petId === pet.id && stored?.window === holding.window
      ? stored
      : null;
  const happening: Happening | null =
    currentHappening(pet, clock) ?? heldOnScreen;
  const petId = pet.id;
  const playing = happening !== null && happening.seen && !happening.done;
  const playingWindow = happening?.window ?? "";

  // A happening being played is not swapped out when a new window starts; it
  // is let go when it finishes or this screen closes.
  useEffect(() => {
    if (!playing) return;
    hold({ petId, window: playingWindow });
    return () => hold(null);
  }, [playing, petId, playingWindow, hold]);
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
