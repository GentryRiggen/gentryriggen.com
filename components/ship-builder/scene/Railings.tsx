"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { Object3D, type InstancedMesh } from "three";
import { analyzeShip } from "@/lib/ship-builder/model/analysis";
import { gridLength } from "@/lib/ship-builder/model/grid";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { DECK_Y } from "./coords";
import { noRaycast } from "./noRaycast";
import { PALETTE } from "./palette";
import { railRuns, stanchionOffsets, type RailRun } from "./railRuns";

const RAIL_HEIGHT = 0.38;
const RAIL_THICKNESS = 0.05;
const STANCHION_SPACING = 0.5;
const STANCHION_SIZE = 0.04;
/** Rail centreline sits this far inside the hull's outer edge. */
const RAIL_INSET = 0.06;
const DECK_TOP = DECK_Y + 0.02;

interface SideRun extends RailRun {
  /** +1 for the model z = 0 edge (world +z), -1 for the far edge. */
  side: 1 | -1;
}

/** Rails and stanchions along each deck edge not covered by a level-0 block. */
export default function Railings() {
  const ship = useShipBuilderStore((s) => s.ship);
  const { beam } = ship.hull;
  const lengthCells = gridLength(ship);

  const runs = useMemo(() => {
    const { occupancy } = analyzeShip(ship);
    const all: SideRun[] = [];
    for (const run of railRuns(occupancy, lengthCells, 0))
      all.push({ ...run, side: 1 });
    for (const run of railRuns(occupancy, lengthCells, beam - 1))
      all.push({ ...run, side: -1 });
    return all;
  }, [ship, lengthCells, beam]);

  const offsets = useMemo(
    () =>
      runs.map((run) =>
        stanchionOffsets(run.end - run.start, STANCHION_SPACING)
      ),
    [runs]
  );
  const stanchionCount = offsets.reduce((sum, list) => sum + list.length, 0);

  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new Object3D();
    let index = 0;
    runs.forEach((run, r) => {
      // Model x grows toward the stern; world x toward the bow.
      const worldStart = lengthCells / 2 - run.end;
      for (const offset of offsets[r]) {
        dummy.position.set(
          worldStart + offset,
          DECK_TOP + RAIL_HEIGHT / 2,
          run.side * (beam / 2 - RAIL_INSET)
        );
        dummy.updateMatrix();
        mesh.setMatrixAt(index++, dummy.matrix);
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [runs, offsets, lengthCells, beam, stanchionCount]);

  if (runs.length === 0) return null;
  return (
    <group>
      <instancedMesh
        key={stanchionCount}
        ref={ref}
        args={[undefined, undefined, stanchionCount]}
        raycast={noRaycast}
        frustumCulled={false}
        castShadow
      >
        <boxGeometry args={[STANCHION_SIZE, RAIL_HEIGHT, STANCHION_SIZE]} />
        <meshStandardMaterial color={PALETTE.railing} />
      </instancedMesh>
      {runs.map((run) => (
        <mesh
          key={`${run.side}:${run.start}`}
          position={[
            lengthCells / 2 - (run.start + run.end) / 2,
            DECK_TOP + RAIL_HEIGHT,
            run.side * (beam / 2 - RAIL_INSET),
          ]}
          raycast={noRaycast}
        >
          <boxGeometry
            args={[run.end - run.start, RAIL_THICKNESS, RAIL_THICKNESS]}
          />
          <meshStandardMaterial color={PALETTE.railing} />
        </mesh>
      ))}
    </group>
  );
}
