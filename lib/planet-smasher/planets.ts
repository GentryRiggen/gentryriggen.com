export type PlanetId = "earth" | "mars" | "ice" | "lava" | "candy" | "ocean";

export interface PlanetSpec {
  id: PlanetId;
  name: string;
  icon: string;
  population: number;
  peopleIcon: string;
  /** The moon ram brings its own moon when this is false. */
  hasMoon: boolean;
}

export const PLANETS: Record<PlanetId, PlanetSpec> = {
  earth: {
    id: "earth",
    name: "Earth",
    icon: "🌍",
    population: 8_000_000_000,
    peopleIcon: "🧍",
    hasMoon: true,
  },
  mars: {
    id: "mars",
    name: "Mars",
    icon: "🔴",
    population: 3_000_000,
    peopleIcon: "👽",
    hasMoon: false,
  },
  ice: {
    id: "ice",
    name: "Frostia",
    icon: "🧊",
    population: 450_000_000,
    peopleIcon: "🐧",
    hasMoon: false,
  },
  lava: {
    id: "lava",
    name: "Magmar",
    icon: "🌋",
    population: 600_000_000,
    peopleIcon: "🔥",
    hasMoon: false,
  },
  candy: {
    id: "candy",
    name: "Sweetopia",
    icon: "🍭",
    population: 2_500_000_000,
    peopleIcon: "🍬",
    hasMoon: false,
  },
  ocean: {
    id: "ocean",
    name: "Aquaria",
    icon: "🌊",
    population: 1_200_000_000,
    peopleIcon: "🐙",
    hasMoon: false,
  },
};

export const PLANET_ORDER: readonly PlanetId[] = [
  "earth",
  "lava",
  "mars",
  "candy",
  "ice",
  "ocean",
];
