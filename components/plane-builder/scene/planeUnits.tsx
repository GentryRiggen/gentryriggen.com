"use client";

import type { ReactNode } from "react";
import PlaneGlbUnit from "./PlaneGlbUnit";
import type { PlaneMaterials } from "./planeMaterials";
import type { PlaneParts } from "./planeParts";
import { Part, SHAPES } from "./planePrimitives";

/**
 * Every glb-able plane piece at unit size, with its old procedural look as
 * the fallback. PlaneModel places and scales these (a unit's size is fixed by
 * its spec bounds), and the asset studio draws one on its own, so the studio
 * shows a piece exactly as the game does.
 */
type Fallback = (materials: PlaneMaterials) => ReactNode;

const FALLBACKS: Record<string, Fallback> = {
  "fuselage-prop": (m) => <Part geometry={SHAPES.fuselage} material={m.body} />,
  "fuselage-sleek": (m) => (
    <Part geometry={SHAPES.fuselage} material={m.body} />
  ),
  "fuselage-pod": (m) => <Part geometry={SHAPES.fuselage} material={m.body} />,
  "wing-straight": (m) => <Part geometry={SHAPES.halfWing} material={m.body} />,
  "wing-glider": (m) => <Part geometry={SHAPES.halfWing} material={m.body} />,
  fin: (m) => (
    <Part geometry={SHAPES.box} material={m.body} scale={[0.4, 0.5, 0.05]} />
  ),
  "fin-swept": (m) => (
    <Part geometry={SHAPES.box} material={m.body} scale={[0.4, 0.5, 0.05]} />
  ),
  stabilizer: (m) => (
    <Part geometry={SHAPES.box} material={m.body} scale={[0.3, 0.04, 1]} />
  ),
  "propeller-blades": (m) => (
    <>
      <Part
        geometry={SHAPES.sphere}
        material={m.dark}
        scale={[0.12, 0.12, 0.12]}
      />
      <Part geometry={SHAPES.box} material={m.dark} scale={[0.03, 2, 0.14]} />
    </>
  ),
  "propeller-spinner": (m) => (
    <Part geometry={SHAPES.cone} material={m.dark} scale={[0.3, 0.2, 0.2]} />
  ),
  float: (m) => (
    <Part
      geometry={SHAPES.capsuleX}
      material={m.trim}
      scale={[1 / 3, 0.1, 0.12]}
    />
  ),
  tyre: (m) => (
    <>
      <Part
        geometry={SHAPES.cylinderX}
        material={m.dark}
        rotation={[0, Math.PI / 2, 0]}
        scale={[0.18, 0.26, 0.26]}
      />
      <Part
        geometry={SHAPES.cylinderX}
        material={m.trim}
        position={[0, 0, 0.02]}
        rotation={[0, Math.PI / 2, 0]}
        scale={[0.18, 0.117, 0.117]}
      />
    </>
  ),
  ski: (m) => (
    <>
      <Part geometry={SHAPES.box} material={m.trim} scale={[1, 0.05, 0.12]} />
      <Part
        geometry={SHAPES.box}
        material={m.trim}
        position={[0.58, 0.05, 0]}
        rotation={[0, 0, 0.5]}
        scale={[0.25, 0.05, 0.12]}
      />
    </>
  ),
  "cabin-box": (m) => (
    <>
      <Part geometry={SHAPES.box} material={m.body} scale={[1, 0.34, 1]} />
      <Part
        geometry={SHAPES.box}
        material={m.dark}
        position={[0.05, 0.04, 0]}
        scale={[0.6, 0.12, 1.04]}
      />
      <Part
        geometry={SHAPES.box}
        material={m.dark}
        position={[0.5, 0.03, 0]}
        scale={[0.045, 0.16, 0.8]}
      />
    </>
  ),
};

/** The names of the units that have a procedural fallback. */
export const FALLBACK_UNITS = Object.keys(FALLBACKS);

interface UnitProps {
  name: string;
  materials: PlaneMaterials;
}

/** One piece at unit size: the glb when it has loaded, else the old mesh. */
export default function Unit({ name, materials }: UnitProps) {
  return (
    <PlaneGlbUnit unit={name} materials={materials}>
      {FALLBACKS[name](materials)}
    </PlaneGlbUnit>
  );
}

/** Which fuselage model a look flies. */
export function fuselageUnit(parts: PlaneParts): string {
  if (parts.hasTwinBooms) return "fuselage-pod";
  if (["jet", "glider", "mountains"].includes(parts.look)) {
    return "fuselage-sleek";
  }
  return "fuselage-prop";
}

export function wingUnit(parts: PlaneParts): string {
  return parts.look === "glider" ? "wing-glider" : "wing-straight";
}

export function finUnit(parts: PlaneParts): string {
  return parts.look === "jet" || parts.look === "glider" ? "fin-swept" : "fin";
}
