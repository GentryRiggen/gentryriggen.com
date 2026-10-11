// lib/plane-builder/levels/meadow.ts
import { makeCatalog } from "../plane/catalog";
import { buildLevel, type LevelSpec } from "./generate";

export const MEADOW_SPEC: LevelSpec = {
  id: "meadow",
  name: "Backyard Meadow",
  blurb: "Rolling hills, trees and a big red barn.",
  seed: 1101,
  finishDistance: 2000,
  corridorHalfWidth: 60,
  payPerMeter: 1.3,
  minPayout: 130,
  terrain: { seed: 11, amplitude: 18, wavelength: 140, flatUntil: 80 },
  coinEvery: 70,
  ringEvery: 220,
  winds: [],
  features: [
    {
      kind: "tree",
      hard: false,
      every: 35,
      half: { x: 2, y: 5, z: 2 },
      lateral: "anywhere",
    },
    {
      kind: "balloon",
      hard: false,
      every: 160,
      half: { x: 2.5, y: 3, z: 2.5 },
      lateral: "anywhere",
      float: 25,
    },
    {
      kind: "barn",
      hard: true,
      every: 350,
      half: { x: 8, y: 6, z: 10 },
      lateral: "anywhere",
      fromX: 600,
    },
  ],
  plane: makeCatalog({
    launcher: { basePrice: 41, from: 14, to: 26, curve: 1.3 },
    wings: { basePrice: 55, from: 0.03, to: 0.09, curve: 1.3 },
    engine: { basePrice: 83, from: 0, to: 5.5, curve: 1.3 },
    fuel: { basePrice: 68, from: 2, to: 16, curve: 1.3 },
    body: { basePrice: 55, from: 0.012, to: 0.004 },
    multiplier: { basePrice: 110, from: 1, to: 1.5 },
    parts: {
      launcher: ["Twig slingshot", "Rubber-band slingshot", "Wooden catapult"],
      wings: ["Paper wings", "Folded wings", "Balsa wings", "Glider wings"],
      engine: ["No engine", "Rubber-band motor", "Tiny propeller"],
      fuel: ["Thimble tank", "Cup tank", "Bottle tank"],
      body: ["Paper body", "Card body", "Balsa body"],
      multiplier: ["Coin pouch", "Coin jar", "Coin bucket"],
    },
  }),
  palette: {
    sky: "#7ec8f2",
    horizon: "#d8f0ff",
    ground: "#6bbf59",
    hill: "#4f9d43",
    hard: "#b5342b",
    soft: "#2f7a32",
    plane: "#f4f1e8",
    trim: "#e0b84a",
  },
};

export const MEADOW = buildLevel(MEADOW_SPEC);
