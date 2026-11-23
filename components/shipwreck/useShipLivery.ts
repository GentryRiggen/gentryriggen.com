import { useEffect } from "react";
import { playback } from "@/lib/shipwreck/playback";
import { getShip } from "@/lib/shipwreck/ships";
import { resolveLivery, type ShipId } from "@/lib/shipwreck/ships/types";

/**
 * Her paint as the save chose it (`saved`; none in an older save, or an
 * id she does not have: her default), put on the stage whenever the ship
 * or the choice changes. Returns the livery shown (null: one paint).
 */
export function useShipLivery(
  ship: ShipId,
  saved: string | null
): string | null {
  const livery = resolveLivery(getShip(ship), saved);
  useEffect(() => {
    playback.getState().setLivery(livery);
  }, [ship, livery]);
  return livery;
}
