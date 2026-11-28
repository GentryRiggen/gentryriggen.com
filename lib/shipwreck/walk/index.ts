/** Walk the decks (see README.md): the pure rules, no three.js. */
export * from "./types";
export { TITANIC_WALK } from "./titanicDecks";
export { LUSITANIA_WALK } from "./lusitaniaDecks";
export { BRITANNIC_WALK } from "./britannicDecks";
export { CARPATHIA_WALK } from "./carpathiaDecks";
export { SHIP_WALKS, walkMapFor, type ShipWalk } from "./registry";
export * from "./slope";
export * from "./step";
export * from "./swim";
export { resetWalkInput, walkInput } from "./walkInput";
