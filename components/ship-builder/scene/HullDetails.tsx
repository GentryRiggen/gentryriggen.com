"use client";

import { useLayoutEffect, useRef } from "react";
import { Object3D, type InstancedMesh } from "three";
import { bowLength } from "@/lib/ship-builder/model/hullEnds";
import type { BowShape } from "@/lib/ship-builder/model/types";
import useTimeOfDay from "../hooks/useTimeOfDay";
import { BOOT_TOP, DECK_Y } from "./coords";
import { LIGHT_COLORS } from "./lightColors";
import { glowFor } from "./timeOfDay";
import { ANCHOR_Y, bowAnchorSpot } from "./hullShapes";
import { noRaycast } from "./noRaycast";
import { PALETTE } from "./palette";

const PORTHOLE_RADIUS = 0.1;
/** Cells left clear of portholes at each end of the hull. */
const PORTHOLE_END_MARGIN = 1;
/** Sits just proud of the hull side so it never z-fights. */
const PORTHOLE_OFFSET = 0.012;
const PORTHOLE_Y = (BOOT_TOP + DECK_Y) / 2 - 0.1;
/** Portholes glow faintly, well below the cabin windows. */
const PORTHOLE_GLOW = 0.7;
/** Anchor clearance from the hull surface (half its thickness plus a gap). */
const ANCHOR_STANDOFF = 0.035;

interface HullDetailsProps {
  lengthCells: number;
  beam: number;
  bow: BowShape;
}

/** One dark disc per cell along both sides of the black band. */
function Portholes({
  lengthCells,
  beam,
}: Pick<HullDetailsProps, "lengthCells" | "beam">) {
  const ref = useRef<InstancedMesh>(null);
  const count = Math.max(0, lengthCells - 2 * PORTHOLE_END_MARGIN) * 2;
  const { timeOfDay } = useTimeOfDay();
  const glow = glowFor(timeOfDay);
  const isLit = glow > 0;

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new Object3D();
    let index = 0;
    for (const side of [1, -1]) {
      for (
        let i = PORTHOLE_END_MARGIN;
        i < lengthCells - PORTHOLE_END_MARGIN;
        i++
      ) {
        dummy.position.set(
          i + 0.5 - lengthCells / 2,
          PORTHOLE_Y,
          side * (beam / 2 + PORTHOLE_OFFSET)
        );
        // Circles face +Z; the far side turns round to face -Z.
        dummy.rotation.set(0, side === 1 ? 0 : Math.PI, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(index++, dummy.matrix);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [lengthCells, beam, count]);

  if (count === 0) return null;
  return (
    <instancedMesh
      key={count}
      ref={ref}
      args={[undefined, undefined, count]}
      raycast={noRaycast}
      frustumCulled={false}
    >
      <circleGeometry args={[PORTHOLE_RADIUS, 12]} />
      <meshStandardMaterial
        color={PALETTE.porthole}
        emissive={isLit ? LIGHT_COLORS.porthole : "#000000"}
        emissiveIntensity={isLit ? PORTHOLE_GLOW * glow : 0}
        toneMapped={!isLit}
      />
    </instancedMesh>
  );
}

/** A small anchor drawn flat in XY, facing +Z, about 0.5 tall. */
function Anchor() {
  const metal = <meshStandardMaterial color={PALETTE.anchor} />;
  return (
    <group>
      <mesh raycast={noRaycast}>
        <boxGeometry args={[0.07, 0.5, 0.05]} />
        {metal}
      </mesh>
      <mesh position={[0, 0.17, 0]} raycast={noRaycast}>
        <boxGeometry args={[0.32, 0.06, 0.05]} />
        {metal}
      </mesh>
      <mesh position={[0, 0.28, 0]} raycast={noRaycast}>
        <torusGeometry args={[0.065, 0.02, 6, 14]} />
        {metal}
      </mesh>
      {/* The crown: a half ring curving under the shank. */}
      <mesh
        position={[0, -0.12, 0]}
        rotation={[0, 0, Math.PI]}
        raycast={noRaycast}
      >
        <torusGeometry args={[0.17, 0.03, 6, 14, Math.PI]} />
        {metal}
      </mesh>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * 0.17, -0.1, 0]}
          rotation={[0, 0, side * 0.6]}
          raycast={noRaycast}
        >
          <boxGeometry args={[0.1, 0.1, 0.05]} />
          {metal}
        </mesh>
      ))}
    </group>
  );
}

function BowAnchors({ lengthCells, beam, bow }: HullDetailsProps) {
  return (
    <>
      {([1, -1] as const).map((side) => {
        const spot = bowAnchorSpot(bow, bowLength(bow), beam / 2, side);
        const nx = Math.sin(spot.yaw);
        const nz = Math.cos(spot.yaw);
        return (
          <group
            key={side}
            position={[
              lengthCells / 2 + spot.x + nx * ANCHOR_STANDOFF,
              ANCHOR_Y,
              spot.z + nz * ANCHOR_STANDOFF,
            ]}
            rotation={[0, spot.yaw, 0]}
          >
            <Anchor />
          </group>
        );
      })}
    </>
  );
}

export default function HullDetails(props: HullDetailsProps) {
  return (
    <group>
      <Portholes lengthCells={props.lengthCells} beam={props.beam} />
      <BowAnchors {...props} />
    </group>
  );
}
