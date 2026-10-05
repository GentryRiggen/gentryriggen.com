import { useEffect, useMemo } from "react";
import { PALETTE } from "./palette";
import Surface, { type PartEmphasis, type PartTint } from "./Surface";
import { FUNNEL_RAKE_RADIANS } from "./effectAnchors";
import {
  buildFunnelBands,
  buildFunnelCap,
  buildFunnelOpening,
  buildSteamPipe,
} from "./funnelGeometry";

const SEGMENTS = 16;
const OPENING_COLOR = "#050505";
const PIPE_COLOR = "#b08d57";

interface FunnelMeshProps {
  /** Body radius at its base and at its top. */
  baseRadius: number;
  topRadius: number;
  bodyHeight: number;
  /** The black cap above the body. */
  capHeight: number;
  /** Paint colour for the body; the bands, cap and pipe keep their own. */
  bodyColor?: string;
  tint: PartTint;
  emphasis: PartEmphasis;
}

/**
 * A liner funnel: a raked body with two bands, a black cap with a rolled rim
 * and dark opening, and a steam pipe and whistle on the aft side. The rim,
 * bands and pipe are each merged into one mesh.
 */
export default function FunnelMesh({
  baseRadius,
  topRadius,
  bodyHeight,
  capHeight,
  bodyColor = PALETTE.funnel,
  tint,
  emphasis,
}: FunnelMeshProps) {
  const surface = { tint, emphasis };
  const geometry = useMemo(() => {
    const dims = { baseRadius, topRadius, bodyHeight, capHeight };
    return {
      bands: buildFunnelBands(dims),
      cap: buildFunnelCap(dims),
      opening: buildFunnelOpening(dims),
      pipe: buildSteamPipe(dims),
    };
  }, [baseRadius, topRadius, bodyHeight, capHeight]);
  useEffect(
    () => () => {
      for (const part of Object.values(geometry)) part.dispose();
    },
    [geometry]
  );
  return (
    <group rotation={[0, 0, FUNNEL_RAKE_RADIANS]}>
      <mesh position={[0, bodyHeight / 2, 0]} castShadow>
        <cylinderGeometry
          args={[topRadius, baseRadius, bodyHeight, SEGMENTS]}
        />
        <Surface color={bodyColor} {...surface} />
      </mesh>
      <mesh geometry={geometry.bands}>
        <Surface color={PALETTE.funnelBand} {...surface} />
      </mesh>
      <mesh geometry={geometry.cap} castShadow>
        <Surface color={PALETTE.funnelTop} {...surface} />
      </mesh>
      <mesh geometry={geometry.opening}>
        <Surface color={OPENING_COLOR} {...surface} />
      </mesh>
      <mesh geometry={geometry.pipe}>
        <Surface color={PIPE_COLOR} finish="metal" {...surface} />
      </mesh>
    </group>
  );
}
