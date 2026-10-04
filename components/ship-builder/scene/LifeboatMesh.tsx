import { SphereGeometry, TorusGeometry, type BufferGeometry } from "three";
import { PALETTE } from "./palette";
import Surface, { type PartEmphasis, type PartTint } from "./Surface";

/** A boat hangs with its rim this far below its attach point. */
const HANG_OFFSET = 0.1;
const COVER_HEIGHT = 0.08;

/**
 * Unit-diameter shapes shared by every lifeboat and scaled per mesh. They live
 * for the whole session, so they are never disposed.
 */
let shared:
  | { hull: BufferGeometry; cover: BufferGeometry; gunwale: BufferGeometry }
  | undefined;

function getShared() {
  shared ??= {
    // Lower half of an ellipsoid: the hull below the rim.
    hull: new SphereGeometry(
      0.5,
      16,
      6,
      0,
      Math.PI * 2,
      Math.PI / 2,
      Math.PI / 2
    ),
    // Upper half: the canvas cover.
    cover: new SphereGeometry(0.5, 16, 4, 0, Math.PI * 2, 0, Math.PI / 2),
    // Flat ring, laid in the XZ plane.
    gunwale: new TorusGeometry(0.5, 0.035, 6, 16).rotateX(Math.PI / 2),
  };
  return shared;
}

interface LifeboatMeshProps {
  length: number;
  width: number;
  /** Depth of the hull below its rim. */
  depth: number;
  hullColor: string;
  tint: PartTint;
  emphasis: PartEmphasis;
}

export default function LifeboatMesh({
  length,
  width,
  depth,
  hullColor,
  tint,
  emphasis,
}: LifeboatMeshProps) {
  const surface = { tint, emphasis };
  const geometry = getShared();
  return (
    <group position={[0, -HANG_OFFSET, 0]}>
      {/* Radius 0.5 scaled by 2 * depth gives a semi-axis of `depth`. */}
      <mesh
        geometry={geometry.hull}
        scale={[length, depth * 2, width]}
        castShadow
      >
        <Surface color={hullColor} {...surface} />
      </mesh>
      <mesh
        geometry={geometry.cover}
        scale={[length * 0.9, COVER_HEIGHT * 2, width * 0.8]}
      >
        <Surface color={PALETTE.boatCover} {...surface} />
      </mesh>
      <mesh geometry={geometry.gunwale} scale={[length, 1, width]}>
        <Surface color={PALETTE.gunwale} {...surface} />
      </mesh>
    </group>
  );
}
