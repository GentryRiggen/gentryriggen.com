import { PALETTE } from "./palette";
import Surface, { type PartEmphasis, type PartTint } from "./Surface";

/** Funnels lean aft (toward world -X; the bow faces +X), pivoting at the base. */
const RAKE_RADIANS = (5 * Math.PI) / 180;
const SEGMENTS = 16;
const BAND_HEIGHT = 0.12;
const BAND_FLARE = 0.012;

interface FunnelMeshProps {
  /** Body radius at its base and at its top. */
  baseRadius: number;
  topRadius: number;
  bodyHeight: number;
  /** The black cap above the body. */
  capHeight: number;
  tint: PartTint;
  emphasis: PartEmphasis;
}

export default function FunnelMesh({
  baseRadius,
  topRadius,
  bodyHeight,
  capHeight,
  tint,
  emphasis,
}: FunnelMeshProps) {
  const surface = { tint, emphasis };
  // The contrasting band sits just under the black cap, so follow the taper.
  const bandCentre = bodyHeight - 0.4;
  const bandRadius = (height: number) =>
    topRadius +
    (baseRadius - topRadius) * (1 - height / bodyHeight) +
    BAND_FLARE;
  return (
    <group rotation={[0, 0, RAKE_RADIANS]}>
      <mesh position={[0, bodyHeight / 2, 0]} castShadow>
        <cylinderGeometry
          args={[topRadius, baseRadius, bodyHeight, SEGMENTS]}
        />
        <Surface color={PALETTE.funnel} {...surface} />
      </mesh>
      <mesh position={[0, bandCentre, 0]}>
        <cylinderGeometry
          args={[
            bandRadius(bandCentre + BAND_HEIGHT / 2),
            bandRadius(bandCentre - BAND_HEIGHT / 2),
            BAND_HEIGHT,
            SEGMENTS,
          ]}
        />
        <Surface color={PALETTE.funnelBand} {...surface} />
      </mesh>
      <mesh position={[0, bodyHeight + capHeight / 2, 0]} castShadow>
        <cylinderGeometry
          args={[topRadius + 0.01, topRadius + 0.01, capHeight, SEGMENTS]}
        />
        <Surface color={PALETTE.funnelTop} {...surface} />
      </mesh>
    </group>
  );
}
