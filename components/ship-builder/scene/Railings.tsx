"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Object3D, type InstancedMesh } from "three";
import { analyzeShip } from "@/lib/ship-builder/model/analysis";
import { gridLength } from "@/lib/ship-builder/model/grid";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { buildTubeGeometry, liftRoute } from "./railGeometry";
import {
  pathLength,
  pointAlong,
  railPaths,
  railRuns,
  resamplePath,
  stanchionOffsets,
  type SideRun,
} from "./railRuns";
import { DECK_TOP, makeSheer } from "./hullTrim";
import { noRaycast } from "./noRaycast";
import { PALETTE } from "./palette";
import { FINISHES } from "./Surface";

const RAIL_HEIGHT = 0.38;
const RAIL_RADIUS = 0.026;
const STANCHION_SPACING = 0.5;
const STANCHION_RADIUS = 0.02;
/** Rail centreline sits this far inside the hull's outer edge. */
const RAIL_INSET = 0.05;
/** Tube vertices are at most this far apart, so the rail follows the sheer. */
const ROUTE_STEP = 0.25;

/**
 * Rails and stanchions along each deck edge not covered by a level-0 block.
 * They carry on round the bow and stern curves and rise with the bulwark.
 */
export default function Railings() {
  const ship = useShipBuilderStore((s) => s.ship);
  const { beam, bow, stern } = ship.hull;
  const lengthCells = gridLength(ship);

  const paths = useMemo(() => {
    const { occupancy } = analyzeShip(ship);
    const runs: SideRun[] = [
      ...railRuns(occupancy, lengthCells, 0).map((run): SideRun => ({
        ...run,
        side: 1,
      })),
      ...railRuns(occupancy, lengthCells, beam - 1).map((run): SideRun => ({
        ...run,
        side: -1,
      })),
    ];
    return railPaths(runs, { lengthCells, beam, bow, stern }, RAIL_INSET);
  }, [ship, lengthCells, beam, bow, stern]);

  const sheer = useMemo(
    () => makeSheer({ lengthCells, beam, bow, stern }),
    [lengthCells, beam, bow, stern]
  );

  const topRail = useMemo(
    () =>
      buildTubeGeometry(
        paths.map(({ points, isClosed }) => ({
          points: liftRoute(
            resamplePath(points, ROUTE_STEP, isClosed),
            (x) => DECK_TOP + sheer(x) + RAIL_HEIGHT
          ),
          isClosed,
        })),
        RAIL_RADIUS
      ),
    [paths, sheer]
  );
  useEffect(() => () => topRail.dispose(), [topRail]);

  const stanchions = useMemo(
    () =>
      paths.flatMap(({ points, isClosed }) => {
        const length = pathLength(points, isClosed);
        const offsets = stanchionOffsets(length, STANCHION_SPACING);
        // A closed rail's last post would sit on its first.
        const usable = isClosed ? offsets.slice(0, -1) : offsets;
        return usable.map((offset) => pointAlong(points, offset, isClosed));
      }),
    [paths]
  );

  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new Object3D();
    stanchions.forEach(([x, z], index) => {
      dummy.position.set(x, DECK_TOP + sheer(x) + RAIL_HEIGHT / 2, z);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [stanchions, sheer]);

  if (paths.length === 0) return null;
  return (
    <group>
      <instancedMesh
        key={stanchions.length}
        ref={ref}
        args={[undefined, undefined, stanchions.length]}
        raycast={noRaycast}
        frustumCulled={false}
        castShadow
      >
        <cylinderGeometry
          args={[STANCHION_RADIUS, STANCHION_RADIUS, RAIL_HEIGHT, 6]}
        />
        <meshStandardMaterial
          color={PALETTE.railing}
          roughness={FINISHES.paint.roughness}
          metalness={FINISHES.paint.metalness}
        />
      </instancedMesh>
      <mesh geometry={topRail} raycast={noRaycast}>
        <meshStandardMaterial
          color={PALETTE.railing}
          roughness={FINISHES.paint.roughness}
          metalness={FINISHES.paint.metalness}
        />
      </mesh>
    </group>
  );
}
