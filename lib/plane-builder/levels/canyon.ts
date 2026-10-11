import { makeCatalog } from "../plane/catalog";
import { buildLevel, type LevelSpec } from "./generate";

export const CANYON_SPEC: LevelSpec = {
  id: "canyon",
  name: "Desert Canyon",
  blurb: "Red rock walls, arches and warm updrafts.",
  seed: 2202,
  finishDistance: 4000,
  corridorHalfWidth: 45,
  payPerMeter: 0.8,
  minPayout: 45,
  terrain: { seed: 22, amplitude: 10, wavelength: 200, flatUntil: 80 },
  coinEvery: 80,
  ringEvery: 260,
  winds: [1200, 2400, 3400].map((fromX) => ({
    fromX,
    toX: fromX + 120,
    lift: 3,
    push: 0,
  })),
  features: [
    {
      kind: "wall",
      hard: true,
      every: 30,
      half: { x: 15, y: 45, z: 6 },
      lateral: "edges",
    },
    {
      kind: "arch",
      hard: true,
      every: 450,
      half: { x: 6, y: 20, z: 8 },
      lateral: "anywhere",
    },
    {
      kind: "bird",
      hard: false,
      every: 90,
      half: { x: 1.5, y: 1, z: 1.5 },
      lateral: "anywhere",
      float: 30,
    },
  ],
  plane: makeCatalog({
    launcher: { basePrice: 300, from: 36, to: 55 },
    wings: { basePrice: 250, from: 0.03, to: 0.04, curve: 0.65 },
    engine: { basePrice: 150, from: 0, to: 40 },
    fuel: { basePrice: 165, from: 10, to: 70 },
    body: { basePrice: 225, from: 0.014, to: 0.008 },
    multiplier: { basePrice: 360, from: 1, to: 2.5 },
    parts: {
      launcher: ["Steel slingshot", "Spring launcher", "Air cannon"],
      wings: ["Short wing", "Long wing", "Biplane wings", "Twin-boom wings"],
      engine: [
        "No engine",
        "Small propeller",
        "Big propeller",
        "Twin propellers",
      ],
      fuel: ["Jerry can", "Wing tanks", "Belly tank"],
      body: ["Canvas body", "Wood body", "Metal body"],
      multiplier: ["Coin bag", "Coin chest", "Coin safe"],
    },
  }),
  palette: {
    sky: "#f2b46b",
    horizon: "#fde3c0",
    ground: "#d98b4e",
    hill: "#b8632f",
    hard: "#9c4a2a",
    soft: "#5b4636",
    plane: "#3b82c4",
    trim: "#f5d76e",
  },
};

export const CANYON = buildLevel(CANYON_SPEC);
