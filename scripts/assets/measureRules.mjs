/** The rules `assets:measure` applies when it writes a spec. */

const DEFAULT_VIEWS = [
  { name: "front", azimuthDeg: 90, elevationDeg: 0, ortho: true },
  { name: "side", azimuthDeg: 0, elevationDeg: 0, ortho: true },
  { name: "three-quarter", azimuthDeg: 35, elevationDeg: 20, ortho: false },
];

/** The first todo line of a generated skeleton: marks a spec nobody edited. */
export const GENERATED_TODO =
  "Slot names are guesses from the old mesh's paints (palette key or paint-<hex>); rename them to match the Blender build and merge or split as the model needs.";

/**
 * Parts whose measured box is not the part's own, and why. Their bounds are
 * hand-written and never overwritten by a measure run.
 */
export const DYNAMIC = {
  "wireless-aerial":
    "The measured box includes the wire to another mast, whose distance depends on the studio ship. The bounds cover the insulator ball and the two wire anchors only; the wires stay procedural (registry subParts).",
  "string-lights":
    "The measured box includes the string to another mast, whose distance depends on the studio ship. The bounds cover the mount and the first bulb's hang only; the string and bulbs stay procedural (registry subParts).",
  "nav-lights":
    "Width comes from the bridge it sits on (props), not the part. Keep the bridge-wide spread procedural or model one lamp and repeat it.",
  propeller:
    "The blades spin, so the bounds use the blades' radial reach in both Y and Z (a spin-proof box). Model the hub and one blade; keep the spinning group procedural (registry subParts).",
};

/** Hand-written boxes for DYNAMIC parts that have an honest fixed extent. */
export const HAND_BOUNDS = {
  // Insulator ball (r 0.045 at y 0.03); wires leave at z = +-0.1 (r 0.014).
  "wireless-aerial": {
    min: [-0.045, -0.015, -0.114],
    max: [0.045, 0.075, 0.114],
  },
  // The mount, with one bulb (r 0.07) hanging 0.06 below it.
  "string-lights": { min: [-0.07, -0.13, -0.07], max: [0.07, 0.02, 0.07] },
  // Shaft r 0.12 x 0.4 along X; blades reach 0.57 out, 0.08 either side.
  propeller: {
    min: [-0.2, -0.5756, -0.5756],
    max: [0.2, 0.5756, 0.5756],
  },
};

/** True when this spec's bounds must not be overwritten by a measure run. */
export function boundsLocked(id, spec) {
  return spec?.boundsFixed === true || Object.hasOwn(DYNAMIC, id);
}

/** The slot colour entry for a measured paint: finish kept when not paint. */
function slotColor(s) {
  return s.finish === "paint"
    ? { color: s.color }
    : { color: s.color, finish: s.finish };
}

/** A skeleton spec for a part with none, from what the studio measured. */
export function skeleton(id, measured) {
  const painted = measured.slots.filter((s) => s.name !== "unlit");
  const unlit = measured.slots.find((s) => s.name === "unlit");
  const slots = [];
  const slotColors = {};
  for (const s of painted) {
    let name = s.name;
    if (slotColors[name]) name = `${name}-${s.finish}`;
    slots.push(name);
    slotColors[name] = slotColor(s);
  }
  const todo = [
    GENERATED_TODO,
    "Fill variants[].dims if the part's size comes from props, and add a script assets/blender/parts/" +
      id +
      ".py exposing build(dims).",
    "Add reference images under assets/refs/manifest.json before scoring.",
  ];
  if (painted.length === 0) {
    todo.unshift("No Surface paints found: list the slots by hand.");
  }
  if (DYNAMIC[id]) todo.push(DYNAMIC[id]);
  if (unlit) {
    todo.push(
      `${unlit.meshes} unlit mesh(es) (glow, lights) are not slots; keep them procedural via the registry's subParts.`
    );
  }
  const hand = HAND_BOUNDS[id];
  return {
    id,
    script: id,
    slots,
    slotColors,
    todo,
    budget: { maxTriangles: 4000, maxBytes: 200000 },
    boundsTolerance: 0.03,
    rakeRadians: measured.rake ?? 0,
    ...(hand ? { boundsFixed: true } : {}),
    weights: { silhouette: 0.6, detail: 0.4 },
    variants: [
      {
        name: id,
        dims: {},
        expectedBounds: hand ?? measured.bounds,
      },
    ],
    views: DEFAULT_VIEWS,
    scoreVariant: id,
  };
}
