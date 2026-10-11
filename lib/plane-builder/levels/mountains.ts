import { makeCatalog } from "../plane/catalog";
import { buildLevel, type LevelSpec } from "./generate";

export const MOUNTAINS_SPEC: LevelSpec = {
  id: "mountains",
  name: "Snowy Mountains",
  blurb: "Huge peaks, crosswinds and a narrow pass.",
  seed: 3303,
  finishDistance: 6000,
  corridorHalfWidth: 70,
  payPerMeter: 0.45,
  minPayout: 45,
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
    launcher: { basePrice: 350, from: 55, to: 75 },
    wings: { basePrice: 300, from: 0.03, to: 0.04, curve: 0.65 },
    engine: { basePrice: 150, from: 0, to: 66 },
    fuel: { basePrice: 180, from: 18, to: 90 },
    body: { basePrice: 260, from: 0.014, to: 0.007 },
    multiplier: { basePrice: 375, from: 1, to: 3 },
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
