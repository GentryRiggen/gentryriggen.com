import * as rules from "../../scripts/assets/measureRules.mjs";

interface Slot {
  name: string;
  color: string;
  finish: string;
  meshes: number;
  triangles: number;
}
interface Measured {
  bounds: { min: number[]; max: number[] };
  slots: Slot[];
  rake?: number;
}
const { boundsLocked, DYNAMIC, HAND_BOUNDS, skeleton, GENERATED_TODO } =
  rules as unknown as {
    boundsLocked: (id: string, spec?: { boundsFixed?: boolean }) => boolean;
    DYNAMIC: Record<string, string>;
    HAND_BOUNDS: Record<string, { min: number[]; max: number[] }>;
    skeleton: (
      id: string,
      m: Measured
    ) => Record<string, unknown> & {
      slotColors: Record<string, { color: string; finish?: string }>;
      variants: { expectedBounds: { min: number[]; max: number[] } }[];
      todo: string[];
      rakeRadians: number;
      boundsFixed?: boolean;
    };
    GENERATED_TODO: string;
  };

const BOUNDS = { min: [-1, 0, -1], max: [1, 2, 1] };
const slot = (name: string, finish: string, color = "#112233"): Slot => ({
  name,
  color,
  finish,
  meshes: 1,
  triangles: 12,
});

describe("boundsLocked", () => {
  it("locks dynamic parts and boundsFixed specs only", () => {
    for (const id of Object.keys(DYNAMIC)) {
      expect(boundsLocked(id, {})).toBe(true);
    }
    expect(boundsLocked("rudder", { boundsFixed: true })).toBe(true);
    expect(boundsLocked("rudder", {})).toBe(false);
  });

  it("has a hand-written box for every dynamic part that has a fixed body", () => {
    for (const id of ["wireless-aerial", "string-lights", "propeller"]) {
      expect(HAND_BOUNDS[id]).toBeDefined();
    }
  });
});

describe("skeleton", () => {
  it("records every non-paint finish in slotColors", () => {
    const spec = skeleton("thing", {
      bounds: BOUNDS,
      slots: [
        slot("hull", "paint", "#ffffff"),
        slot("window", "glass", "#222222"),
        slot("rail", "metal", "#333333"),
        slot("deck", "wood", "#444444"),
      ],
    });
    expect(spec.slotColors).toEqual({
      hull: { color: "#ffffff" },
      window: { color: "#222222", finish: "glass" },
      rail: { color: "#333333", finish: "metal" },
      deck: { color: "#444444", finish: "wood" },
    });
    expect(spec.todo[0]).toBe(GENERATED_TODO);
  });

  it("keeps the studio's rake and its measured bounds", () => {
    const spec = skeleton("tilted", {
      bounds: BOUNDS,
      slots: [slot("body", "paint")],
      rake: 0.0873,
    });
    expect(spec.rakeRadians).toBe(0.0873);
    expect(spec.variants[0].expectedBounds).toEqual(BOUNDS);
    expect(spec.boundsFixed).toBeUndefined();
  });

  it("writes hand bounds, boundsFixed and a todo for a dynamic part", () => {
    const spec = skeleton("wireless-aerial", {
      bounds: { min: [-37, 0, 0], max: [0, 1, 1] },
      slots: [slot("paint", "metal")],
    });
    expect(spec.variants[0].expectedBounds).toEqual(
      HAND_BOUNDS["wireless-aerial"]
    );
    expect(spec.boundsFixed).toBe(true);
    expect(spec.todo).toContain(DYNAMIC["wireless-aerial"]);
  });
});
