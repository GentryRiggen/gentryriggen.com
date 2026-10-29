import { useEffect, useMemo } from "react";
import { AO_OCCLUDER } from "./aoLayer";
import Surface, { type PartEmphasis, type PartTint } from "./Surface";
import {
  buildFunnelBands,
  buildFunnelCap,
  buildFunnelOpening,
  buildSteamPipe,
  type FunnelDims,
} from "./funnelGeometry";

const SEGMENTS = 16;

/** A funnel's colour per paint slot. */
export interface FunnelSlotColors {
  body: string;
  bands: string;
  cap: string;
  opening: string;
  pipe: string;
}

interface ProceduralFunnelProps extends FunnelDims {
  colors: FunnelSlotColors;
  tint: PartTint;
  emphasis: PartEmphasis;
}

/**
 * The funnel built in code, unraked: a body, two bands, a black cap with a
 * rolled rim and dark opening, and a steam pipe and whistle on the aft side.
 * The rim, bands and pipe are each merged into one mesh. `FunnelMesh` draws
 * it while the Blender model loads, or if that fails.
 */
export default function ProceduralFunnel({
  baseRadius,
  topRadius,
  bodyHeight,
  capHeight,
  colors,
  tint,
  emphasis,
}: ProceduralFunnelProps) {
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
    <>
      <mesh {...AO_OCCLUDER} position={[0, bodyHeight / 2, 0]} castShadow>
        <cylinderGeometry
          args={[topRadius, baseRadius, bodyHeight, SEGMENTS]}
        />
        <Surface color={colors.body} {...surface} />
      </mesh>
      <mesh geometry={geometry.bands}>
        <Surface color={colors.bands} {...surface} />
      </mesh>
      <mesh {...AO_OCCLUDER} geometry={geometry.cap} castShadow>
        <Surface color={colors.cap} {...surface} />
      </mesh>
      <mesh geometry={geometry.opening}>
        <Surface color={colors.opening} {...surface} />
      </mesh>
      <mesh geometry={geometry.pipe}>
        <Surface color={colors.pipe} finish="metal" {...surface} />
      </mesh>
    </>
  );
}
