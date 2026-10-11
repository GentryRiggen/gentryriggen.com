import { makeCatalog } from "../plane/catalog";
import { buildLevel, type LevelSpec } from "./generate";

export const MOUNTAINS_SPEC: LevelSpec = {
  id: "mountains",
  name: "Snowy Mountains",
  blurb: "Huge peaks, crosswinds and a narrow pass.",
  seed: 3303,
  finishDistance: 6000,
  corridorHalfWidth: 70,
  payPerMeter: 2.354,
  minPayout: 49,
  terrain: { seed: 33, amplitude: 40, wavelength: 260, flatUntil: 80 },
  coinEvery: 90,
  ringEvery: 300,
  winds: [1, 2, 3, 4, 5].map((k) => ({
    fromX: 1000 * k,
    toX: 1000 * k + 200,
    lift: 0,
    push: k % 2 ? 5 : -5,
  })),
  features: [
    {
      kind: "peak",
      hard: true,
      every: 450,
      half: { x: 25, y: 60, z: 25 },
      lateral: "anywhere",
      fromX: 1300,
      toX: 5500,
    },
    {
      kind: "wall",
      hard: true,
      every: 20,
      half: { x: 12, y: 80, z: 8 },
      lateral: "edges",
      fromX: 5500,
      toX: 6300,
    },
    {
      kind: "bird",
      hard: false,
      every: 120,
      half: { x: 1.5, y: 1, z: 1.5 },
      lateral: "anywhere",
      float: 50,
    },
  ],
  plane: makeCatalog({
    launcher: { basePrice: 61, from: 25, to: 57.13, curve: 1.3 },
    wings: { basePrice: 168, from: 0.03, to: 0.1371, curve: 1.3 },
    engine: { basePrice: 242, from: 0, to: 14.28, curve: 1.3 },
    fuel: { basePrice: 298, from: 4, to: 36.84, curve: 1.3 },
    body: { basePrice: 1527, from: 0.012, to: 0.003 },
    multiplier: { basePrice: 273, from: 1, to: 1.5 },
    parts: {
      launcher: ["Steam catapult", "Rail launcher", "Rocket sled"],
      wings: ["Trainer wings", "Straight wings", "Swept wings", "Delta wings"],
      engine: ["No engine", "Small jet", "Twin jets", "Afterburners"],
      fuel: ["Small tank", "Drop tanks", "Big drop tanks"],
      body: ["Trainer body", "Sleek body", "Stealth body"],
      multiplier: ["Coin crate", "Coin vault", "Golden vault"],
    },
  }),
  palette: {
    sky: "#9cc9ee",
    horizon: "#eef6ff",
    ground: "#f4f7fb",
    hill: "#cfd9e6",
    hard: "#6d7889",
    soft: "#3a4656",
    plane: "#d9dee6",
    trim: "#e2483d",
  },
};

export const MOUNTAINS = buildLevel(MOUNTAINS_SPEC);
