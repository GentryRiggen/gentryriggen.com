import type { EmoteId } from "@/lib/flamelings/catalog";
import type { Happening } from "@/lib/flamelings/happenings";

/** What every happening on the glade gets from the pet view. */
export interface HappeningProps {
  petId: string;
  happening: Happening;
  /** Makes the pet react (a laugh by default). */
  onCheer: (emote?: EmoteId) => void;
}

/** The spot on the left of the glade where visitors, the X and the cake sit. */
export const LEFT_SPOT = "left-[3%] top-[54%]";
