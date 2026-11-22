import type { ShipId } from "@/lib/shipwreck/ships/types";

/** For the grown-ups: shown on the title screen (per ship) and the Versions page. */
export const PARENT_LINES: Record<ShipId, string> = {
  titanic:
    "Based on the real sinking of the Titanic in 1912. More than 1,500 people died; this game shows only the ship.",
  lusitania:
    "This is the Lusitania in 1915. A torpedo sank her in 18 minutes during the First World War, and more than 1,190 people died. This game shows only the ship.",
};

/** The Titanic's line (the 1.0 line). */
export const PARENT_LINE = PARENT_LINES.titanic;
