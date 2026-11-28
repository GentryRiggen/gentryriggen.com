import type { ShipId } from "../ships/types";
import { TITANIC_INTERIOR } from "./titanic";
import type { InteriorMap } from "./types";

/** The room kit and the ships' rooms (see README.md): pure, no three.js. */
export * from "./types";
export * from "./kit";
export * from "./lights";
export * from "./merge";
export * from "./water";
export * from "./easeLevel";
export * from "./doorExit";
export * from "./doorArrow";
export * from "./entries";
export { TITANIC_INTERIOR } from "./titanic";

/** A ship's interior, or null for a ship you cannot go inside. */
export function interiorFor(ship: ShipId): InteriorMap | null {
  return ship === "titanic" ? TITANIC_INTERIOR : null;
}
