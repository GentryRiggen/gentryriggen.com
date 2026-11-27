import type { ShipId } from "@/lib/shipwreck/ships/types";

/** For the grown-ups: shown on the title screen (per ship) and the Versions page. */
export const PARENT_LINES: Record<ShipId, string> = {
  titanic:
    "Based on the real sinking of the Titanic in 1912. More than 1,500 people died; this game shows only the ship. You can walk her open decks and some of her rooms.",
  lusitania:
    "This is the Lusitania in 1915. A torpedo sank her in 18 minutes during the First World War, and more than 1,190 people died. This game shows only the ship. You can walk her open decks.",
  fitzgerald:
    "This is the Edmund Fitzgerald, an ore carrier on Lake Superior. She sank in a storm on 10 November 1975, and all 29 of her crew died. This game shows only the ship.",
  carpathia:
    "This is the Carpathia, the ship that rescued the Titanic's survivors in 1912. During the First World War, on 17 July 1918, a U-boat's torpedoes sank her off Ireland, and five of her crew died. This game shows only the ship.",
  britannic:
    "This is the Britannic in 1916, a hospital ship in the First World War. A mine sank her in 55 minutes, and 30 people died. This game shows only the ship.",
  concordia:
    "This is the Costa Concordia, a cruise ship, in January 2012. At night she sailed too close to the island of Giglio, struck rocks and rolled onto her side beside the harbour. Most of the 4,229 people aboard were rescued, but 32 people died. This game shows only the ship.",
  poseidon:
    "The Poseidon is not a real ship. She is a made-up cruise ship from a 2006 film, rolled over by a giant wave on New Year's Eve. Real ships have met waves nearly this big. This game shows what physics says could happen to a ship turned upside down, and it shows only the ship.",
};

/** The Titanic's line (the 1.0 line). */
export const PARENT_LINE = PARENT_LINES.titanic;
