import type { FunnelMark } from "@/lib/ship-builder/model/funnelLivery";
import { getFunnelMarkTexture } from "./funnelMarkTexture";
import { noRaycast } from "./noRaycast";

/** Keeps the decal just off the body so it doesn't z-fight. */
const OFFSET = 0.01;

interface FunnelMarkDecalsProps {
  mark: FunnelMark;
  /** Height of the decal centre above the funnel base. */
  height: number;
  /** Body radius across the ship (world Z) at that height. */
  radius: number;
  /** Side length of the square decal. */
  size: number;
}

/** The funnel's mark on both flanks, reading correctly from outside. */
export default function FunnelMarkDecals({
  mark,
  height,
  radius,
  size,
}: FunnelMarkDecalsProps) {
  const texture = getFunnelMarkTexture(mark);
  if (!texture) return null;
  return (
    <>
      {([1, -1] as const).map((side) => (
        <mesh
          key={side}
          position={[0, height, side * (radius + OFFSET)]}
          rotation={[0, side === 1 ? 0 : Math.PI, 0]}
          raycast={noRaycast}
        >
          <planeGeometry args={[size, size]} />
          <meshStandardMaterial
            map={texture}
            transparent
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-2}
          />
        </mesh>
      ))}
    </>
  );
}
