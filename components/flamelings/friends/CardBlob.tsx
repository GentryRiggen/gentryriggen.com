import type { EmoteId } from "@/lib/flamelings/catalog";
import type { Mood } from "@/lib/flamelings/sim";
import type { PetCard } from "@/lib/flamelings/types";
import Blob from "../Blob";

interface CardBlobProps {
  card: PetCard;
  mood?: Mood;
  emote?: EmoteId | null;
  emoteKey?: number;
  className?: string;
}

/** A friend's pet drawn from its public card (look, hat, face, neck, stage, form). */
export default function CardBlob({
  card,
  mood = "happy",
  emote = null,
  emoteKey = 0,
  className = "size-32",
}: CardBlobProps) {
  const { hat, face, neck, ...look } = card.look;
  return (
    <Blob
      look={look}
      worn={{
        hat: hat === "none" ? null : hat,
        face: face === "none" ? null : face,
        neck: neck === "none" ? null : neck,
      }}
      form={card.form === "none" ? null : card.form}
      stage={card.stage}
      mood={mood}
      emote={emote}
      emoteKey={emoteKey}
      className={className}
    />
  );
}
