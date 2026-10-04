import type { ShipKind } from "./kinds";
import {
  PART_TYPES,
  type AttachPointType,
  type PartCategory,
  type PartDef,
  type PartType,
} from "./types";

export const CATEGORIES: readonly { id: PartCategory; name: string }[] = [
  { id: "decks", name: "Decks" },
  { id: "cabins", name: "Cabins" },
  { id: "command", name: "Command" },
  { id: "funnels", name: "Funnels" },
  { id: "masts", name: "Masts" },
  { id: "lifeboats", name: "Lifeboat gear" },
  { id: "propulsion", name: "Propulsion" },
];

export const ATTACH_POINT_LABELS: Record<AttachPointType, string> = {
  "funnel-mount": "deck block with nothing on top",
  "mast-mount": "mast mount",
  "davit-point": "boat-deck edge",
  "boat-mount": "davit",
  "large-funnel-mount": "2×2 of deck blocks with nothing on top",
  "big-boat-mount": "pair of side-by-side davits",
  "prop-mount": "propeller spot under the stern",
  "rudder-mount": "rudder spot under the stern",
};

/** The 4-wide bridge keeps the original `bridge` id so old saves still load. */
function bridgeDef(type: PartType, width: number): PartDef {
  return {
    type,
    category: "command",
    name: `Bridge · ${width} wide`,
    description: "Forward half, top of its stack",
    placement: "grid",
    role: "bridge",
    footprint: { x: 1, z: width },
    mass: 1,
    height: 1,
  };
}

export const CATALOG: Record<PartType, PartDef> = {
  "deck-1x1": {
    type: "deck-1x1",
    category: "decks",
    name: "Deck block 1×1",
    description: "Superstructure · stacks four high",
    placement: "grid",
    role: "deck",
    footprint: { x: 1, z: 1 },
    mass: 1,
    height: 1,
  },
  "deck-2x1": {
    type: "deck-2x1",
    category: "decks",
    name: "Deck block 2×1",
    description: "Superstructure · stacks four high",
    placement: "grid",
    role: "deck",
    footprint: { x: 2, z: 1 },
    mass: 1,
    height: 1,
  },
  "cabin-1st": {
    type: "cabin-1st",
    category: "cabins",
    name: "First-class cabins",
    description: "30 passengers",
    placement: "grid",
    role: "cabin",
    footprint: { x: 1, z: 1 },
    mass: 1,
    height: 1,
    passengers: { cabinClass: "first", count: 30 },
  },
  "cabin-2nd": {
    type: "cabin-2nd",
    category: "cabins",
    name: "Second-class cabins",
    description: "50 passengers",
    placement: "grid",
    role: "cabin",
    footprint: { x: 1, z: 1 },
    mass: 1,
    height: 1,
    passengers: { cabinClass: "second", count: 50 },
  },
  "cabin-3rd": {
    type: "cabin-3rd",
    category: "cabins",
    name: "Third-class berths",
    description: "120 passengers",
    placement: "grid",
    role: "cabin",
    footprint: { x: 1, z: 1 },
    mass: 1,
    height: 1,
    passengers: { cabinClass: "third", count: 120 },
  },
  "cabin-crew": {
    type: "cabin-crew",
    category: "cabins",
    name: "Crew quarters",
    description: "60 crew berths",
    placement: "grid",
    role: "cabin",
    footprint: { x: 1, z: 1 },
    mass: 1,
    height: 1,
    crewBerths: 60,
  },
  "bridge-3": bridgeDef("bridge-3", 3),
  bridge: bridgeDef("bridge", 4),
  "bridge-5": bridgeDef("bridge-5", 5),
  "bridge-6": bridgeDef("bridge-6", 6),
  "bridge-7": bridgeDef("bridge-7", 7),
  funnel: {
    type: "funnel",
    kinds: ["liner"],
    category: "funnels",
    name: "Funnel",
    description: "Smokestack · sits on a deck block · 40 stokers",
    placement: "attach",
    attachTo: "funnel-mount",
    mass: 2,
    height: 3.2,
    stokers: 40,
    power: 1,
    emptyHint: "Place a deck block with nothing on top of it first",
  },
  mast: {
    type: "mast",
    category: "masts",
    name: "Mast",
    description: "Bow, stern or on top of a deck block",
    placement: "attach",
    attachTo: "mast-mount",
    mass: 0.5,
    height: 7,
    emptyHint: "Every mast spot is taken",
  },
  davit: {
    type: "davit",
    category: "lifeboats",
    name: "Davit",
    description: "Boat-deck edge, on any block",
    placement: "attach",
    attachTo: "davit-point",
    mass: 0.1,
    height: 1,
    emptyHint: "Build a block on an outer edge of the ship",
  },
  "lifeboat-standard": {
    type: "lifeboat-standard",
    category: "lifeboats",
    name: "Lifeboat",
    description: "65 seats · hangs from a davit",
    placement: "attach",
    attachTo: "boat-mount",
    mass: 0.2,
    height: 0.4,
    seats: 65,
    emptyHint: "Every davit has a boat — add another davit",
  },
  "lifeboat-collapsible": {
    type: "lifeboat-collapsible",
    kinds: ["liner"],
    category: "lifeboats",
    name: "Collapsible lifeboat",
    description: "47 seats · hangs from a davit",
    placement: "attach",
    attachTo: "boat-mount",
    mass: 0.2,
    height: 0.4,
    seats: 47,
    emptyHint: "Every davit has a boat — add another davit",
  },
  "funnel-large": {
    type: "funnel-large",
    kinds: ["liner"],
    category: "funnels",
    name: "Large funnel",
    description: "Big smokestack · sits on a 2×2 of deck blocks · 75 stokers",
    placement: "attach",
    attachTo: "large-funnel-mount",
    mass: 4,
    height: 4.2,
    stokers: 75,
    power: 2,
    emptyHint: "Make a 2×2 of deck blocks with nothing on top",
  },
  "lifeboat-large": {
    type: "lifeboat-large",
    kinds: ["liner"],
    category: "lifeboats",
    name: "Large lifeboat",
    description: "150 seats · hangs between two davits",
    placement: "attach",
    attachTo: "big-boat-mount",
    mass: 0.4,
    height: 0.5,
    seats: 150,
    emptyHint: "Put two davits side by side on the same deck edge",
  },
  propeller: {
    type: "propeller",
    category: "propulsion",
    name: "Propeller",
    description: "Mounts under the stern · pushes the ship",
    placement: "attach",
    attachTo: "prop-mount",
    mass: 0.3,
    height: 0.5,
    emptyHint: "Every propeller spot is taken",
  },
  rudder: {
    type: "rudder",
    category: "propulsion",
    name: "Rudder",
    description: "Under the stern · steers the ship",
    placement: "attach",
    attachTo: "rudder-mount",
    mass: 0.2,
    height: 0.9,
    emptyHint: "The rudder spot is taken",
  },
};

export function getPartDef(type: PartType): PartDef {
  return CATALOG[type];
}

export function partsInCategory(category: PartCategory): PartDef[] {
  return PART_TYPES.map((type) => CATALOG[type]).filter(
    (def) => def.category === category
  );
}

/**
 * The parts to list for a ship kind: its own plus the shared ones, or every
 * part when showAll is set. Always in catalog order.
 */
export function visibleParts(kind: ShipKind, showAll: boolean): PartDef[] {
  const defs = PART_TYPES.map((type) => CATALOG[type]);
  return showAll
    ? defs
    : defs.filter((def) => def.kinds === undefined || def.kinds.includes(kind));
}
