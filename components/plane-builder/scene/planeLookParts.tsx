"use client";

import type { Material } from "three";
import type { PlaneParts } from "./planeParts";
import Unit from "./planeUnits";
import {
  FUSELAGE_RADIUS,
  Part,
  Propeller,
  SHAPES,
  Strut,
  type PlaneMaterials,
} from "./planePrimitives";

/**
 * The pieces that make the newer worlds' planes look different: gear, cabin,
 * booms, pods and jet tails. Each one reads only `PlaneParts`, so it grows
 * with upgrade tiers the same way the flags do.
 */
interface LookPartProps {
  parts: PlaneParts;
  materials: PlaneMaterials;
}

/** How much of the body length the storm plane's pod takes up. */
export const POD_SHARE = 0.6;

const SIDES = [-1, 1] as const;
const FLOAT_RADIUS = 0.1;
const FLOAT_Y = -0.58;
const FLOAT_Z = 0.4;
const TYRE_Y = -0.52;
const TYRE_Z = 0.4;
const SKI_Y = -0.55;
const SKI_Z = 0.4;
const BOOM_Z = 0.5;
const POD_Y = -0.14;

function bodyRadius(parts: PlaneParts): number {
  return FUSELAGE_RADIUS * parts.girth;
}

function Floats({ parts, materials }: LookPartProps) {
  const length = parts.bodyLength * 0.75;
  const centreX = 0.05;
  return SIDES.map((side) => (
    <group key={`float-${side}`}>
      <group
        position={[centreX, FLOAT_Y, side * FLOAT_Z]}
        scale={[length, 1, 1]}
      >
        <Unit name="float" materials={materials} />
      </group>
      {[0.28, -0.28].map((share) => (
        <Strut
          key={share}
          x={centreX + share * length}
          from={[-0.1, side * 0.12]}
          to={[FLOAT_Y + FLOAT_RADIUS * 0.6, side * FLOAT_Z]}
          material={materials.dark}
        />
      ))}
    </group>
  ));
}

function Tyres({ parts, materials }: LookPartProps) {
  const tail = -parts.bodyLength / 2;
  return (
    <>
      {SIDES.map((side) => (
        <group key={`tyre-${side}`}>
          <group position={[0.3, TYRE_Y, side * TYRE_Z]} scale={[1, 1, side]}>
            <Unit name="tyre" materials={materials} />
          </group>
          <Strut
            x={0.3}
            from={[-0.12, side * 0.15]}
            to={[TYRE_Y, side * TYRE_Z]}
            material={materials.dark}
          />
        </group>
      ))}
      <Part
        geometry={SHAPES.sphere}
        material={materials.dark}
        position={[tail + 0.1, -0.2, 0]}
        scale={[0.07, 0.07, 0.07]}
      />
    </>
  );
}

function Skis({ parts, materials }: LookPartProps) {
  const length = parts.bodyLength * 0.55;
  const centreX = 0.1;
  return SIDES.map((side) => (
    <group key={`ski-${side}`}>
      <group position={[centreX, SKI_Y, side * SKI_Z]} scale={[length, 1, 1]}>
        <Unit name="ski" materials={materials} />
      </group>
      {[0.3, -0.3].map((share) => (
        <Strut
          key={share}
          x={centreX + share * length}
          from={[-0.12, side * 0.15]}
          to={[SKI_Y + 0.02, side * SKI_Z]}
          material={materials.dark}
        />
      ))}
    </group>
  ));
}

/** Floats, tyres or skis, whichever this plane lands on. */
export function LandingGear({ parts, materials }: LookPartProps) {
  switch (parts.gear) {
    case "floats":
      return <Floats parts={parts} materials={materials} />;
    case "tyres":
      return <Tyres parts={parts} materials={materials} />;
    case "skis":
      return <Skis parts={parts} materials={materials} />;
    default:
      return null;
  }
}

/** Struts that brace a high wing against the body. */
export function WingStruts({ parts, materials }: LookPartProps) {
  const half = parts.wingSpan / 2;
  return SIDES.map((side) => (
    <Strut
      key={`brace-${side}`}
      x={0.35}
      from={[-0.08, side * bodyRadius(parts) * 0.8]}
      to={[parts.wingHeight - 0.05, side * half * 0.55]}
      material={materials.dark}
    />
  ));
}

/** The ski plane's boxy cabin, with a dark band of windows. */
export function Cabin({ parts, materials }: LookPartProps) {
  const length = parts.bodyLength * 0.45;
  const width = bodyRadius(parts) * 1.8;
  return (
    <group position={[0.2, 0.15, 0]} scale={[length, 1, width]}>
      <Unit name="cabin-box" materials={materials} />
    </group>
  );
}

/** Two booms and the horizontal tail that joins them. */
export function TwinBooms({ parts, materials }: LookPartProps) {
  const tail = -parts.bodyLength / 2;
  const wingX = 0.2;
  return (
    <>
      {SIDES.map((side) => (
        <group key={`boom-${side}`}>
          <Part
            geometry={SHAPES.cylinderX}
            material={materials.body}
            position={[(wingX + tail) / 2, 0.05, side * BOOM_Z]}
            scale={[wingX - tail, 0.06, 0.06]}
          />
          <Part
            geometry={SHAPES.box}
            material={materials.body}
            position={[tail + 0.12, 0.25, side * BOOM_Z]}
            scale={[0.35, 0.45, 0.04]}
          />
        </group>
      ))}
      <Part
        geometry={SHAPES.box}
        material={materials.body}
        position={[tail + 0.12, 0.43, 0]}
        scale={[0.3, 0.04, BOOM_Z * 2]}
      />
    </>
  );
}

/** The pusher propeller at the back of the storm plane's pod. */
export function PusherPropeller({ parts, materials }: LookPartProps) {
  const podLength = parts.bodyLength * POD_SHARE;
  const podBack = parts.bodyLength / 2 - podLength;
  return (
    <Propeller
      position={[podBack - 0.06, 0, 0]}
      size={0.45 * parts.engineScale}
      materials={materials}
    />
  );
}

/** Engine pods hung on the wings, with propellers once the engine is upgraded. */
export function EnginePods({ parts, materials }: LookPartProps) {
  const scale = parts.engineScale;
  const half = parts.wingSpan / 2;
  const z = Math.max(0.5, half * 0.4);
  const centreX = 0.2;
  const front = centreX + 0.45 * scale;
  return SIDES.map((side) => (
    <group key={`pod-${side}`} position={[0, POD_Y, side * z]}>
      <Part
        geometry={SHAPES.cylinderX}
        material={materials.body}
        position={[centreX, 0, 0]}
        scale={[0.9 * scale, 0.16 * scale, 0.16 * scale]}
      />
      <Part
        geometry={SHAPES.cone}
        material={materials.trim}
        position={[front + 0.1, 0, 0]}
        scale={[0.2 * scale, 0.15 * scale, 0.15 * scale]}
      />
      {parts.hasPodPropellers ? (
        <Propeller
          position={[front + 0.22, 0, 0]}
          size={0.4 * scale}
          materials={materials}
        />
      ) : null}
    </group>
  ));
}

const GLOW_LENGTH_BASE = 0.1;
const GLOW_LENGTH_STEP = 0.2;

/** The jet's engine at the back: intakes, a nozzle, and a glow that grows. */
export function JetTail({ parts, materials }: LookPartProps) {
  const tail = -parts.bodyLength / 2;
  const radius = bodyRadius(parts) * 0.8 * parts.engineScale;
  const glowMaterial: Material =
    parts.look === "glider" ? materials.glow : materials.fire;
  const glowLength = GLOW_LENGTH_BASE + GLOW_LENGTH_STEP * parts.exhaustGlow;
  return (
    <>
      <Part
        geometry={SHAPES.cylinderX}
        material={materials.dark}
        position={[tail + 0.15, 0, 0]}
        scale={[0.5, radius, radius]}
      />
      <Part
        geometry={SHAPES.cylinderX}
        material={materials.trim}
        position={[tail - 0.06, 0, 0]}
        scale={[0.12, radius + 0.02, radius + 0.02]}
      />
      {parts.exhaustGlow > 0 ? (
        <Part
          geometry={SHAPES.cone}
          material={glowMaterial}
          position={[tail - 0.12 - glowLength / 2, 0, 0]}
          rotation={[0, Math.PI, 0]}
          scale={[glowLength, radius * 0.8, radius * 0.8]}
        />
      ) : null}
      {parts.hasIntakes
        ? SIDES.map((side) => (
            <Part
              key={`intake-${side}`}
              geometry={SHAPES.box}
              material={materials.dark}
              position={[-0.25, 0.03, side * (bodyRadius(parts) - 0.02)]}
              scale={[0.3, 0.14, 0.06]}
            />
          ))
        : null}
    </>
  );
}

/** A pointed nose cone in front of the body. */
export function PointedNose({ parts, materials }: LookPartProps) {
  const radius = bodyRadius(parts);
  return (
    <Part
      geometry={SHAPES.cone}
      material={materials.body}
      position={[parts.bodyLength / 2 + 0.17, 0, 0]}
      scale={[0.45, radius, radius]}
    />
  );
}
