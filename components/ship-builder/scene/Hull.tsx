"use client";

import { useMemo } from "react";
import { Shape } from "three";
import { PROW_LENGTH, STERN_LENGTH } from "@/lib/ship-builder/model/attach";
import { GRID_WIDTH } from "@/lib/ship-builder/model/grid";
import { BOOT_TOP, DECK_Y, HULL_DRAFT } from "./coords";
import { PALETTE } from "./palette";

interface HullProps {
  lengthCells: number;
}

interface HullBandProps {
  lengthCells: number;
  bottom: number;
  top: number;
  color: string;
  prow: Shape;
}

function HullBand({ lengthCells, bottom, top, color, prow }: HullBandProps) {
  const height = top - bottom;
  const half = lengthCells / 2;
  const radius = GRID_WIDTH / 2;
  return (
    <group>
      <mesh position={[0, bottom + height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[lengthCells, height, GRID_WIDTH]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Prow: triangle in XY, extruded along Z, turned so Z becomes up. */}
      <mesh
        position={[half, bottom, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        castShadow
      >
        <extrudeGeometry
          args={[prow, { depth: height, bevelEnabled: false }]}
        />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Stern: half cylinder facing -X, squashed to STERN_LENGTH. */}
      <mesh
        position={[-half, bottom + height / 2, 0]}
        scale={[STERN_LENGTH / radius, 1, 1]}
        castShadow
      >
        <cylinderGeometry
          args={[radius, radius, height, 24, 1, false, Math.PI, Math.PI]}
        />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

export default function Hull({ lengthCells }: HullProps) {
  const prow = useMemo(() => {
    const shape = new Shape();
    shape.moveTo(0, -GRID_WIDTH / 2);
    shape.lineTo(PROW_LENGTH, 0);
    shape.lineTo(0, GRID_WIDTH / 2);
    shape.closePath();
    return shape;
  }, []);

  return (
    <group>
      <HullBand
        lengthCells={lengthCells}
        bottom={-HULL_DRAFT}
        top={BOOT_TOP}
        color={PALETTE.antifouling}
        prow={prow}
      />
      <HullBand
        lengthCells={lengthCells}
        bottom={BOOT_TOP}
        top={DECK_Y}
        color={PALETTE.hull}
        prow={prow}
      />
      <mesh position={[0, DECK_Y + 0.01, 0]} receiveShadow>
        <boxGeometry args={[lengthCells, 0.02, GRID_WIDTH]} />
        <meshStandardMaterial color={PALETTE.deck} />
      </mesh>
    </group>
  );
}
