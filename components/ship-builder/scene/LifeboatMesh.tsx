import { PALETTE } from "./palette";
import { getLifeboatGeometry } from "./lifeboatGeometry";
import Surface, { type PartEmphasis, type PartTint } from "./Surface";

/** A boat hangs with its rim this far below its attach point. */
const HANG_OFFSET = 0.1;
const COVER_HEIGHT = 0.08;

interface LifeboatMeshProps {
  length: number;
  width: number;
  /** Depth of the hull below its rim. */
  depth: number;
  hullColor: string;
  tint: PartTint;
  emphasis: PartEmphasis;
}

/**
 * A lofted open boat: pointed bow (+X), rounded stern, a slight sheer, a
 * gunwale band and a ridged cover. The geometry is shared per boat size.
 */
export default function LifeboatMesh({
  length,
  width,
  depth,
  hullColor,
  tint,
  emphasis,
}: LifeboatMeshProps) {
  const surface = { tint, emphasis };
  const geometry = getLifeboatGeometry({
    length,
    width,
    depth,
    coverHeight: COVER_HEIGHT,
  });
  return (
    <group position={[0, -HANG_OFFSET, 0]}>
      <mesh geometry={geometry.hull} castShadow>
        <Surface color={hullColor} {...surface} />
      </mesh>
      <mesh geometry={geometry.cover}>
        <Surface color={PALETTE.boatCover} finish="wood" {...surface} />
      </mesh>
      <mesh geometry={geometry.trim}>
        <Surface color={PALETTE.gunwale} finish="wood" {...surface} />
      </mesh>
    </group>
  );
}
