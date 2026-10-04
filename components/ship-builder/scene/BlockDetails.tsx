"use client";

import { useEffect, useMemo } from "react";
import type { GridPartDef } from "@/lib/ship-builder/model/types";
import {
  BRIDGE_WINDOW_ROWS,
  buildWindowGeometries,
  CABIN_WINDOW_ROWS,
  type BlockSize,
} from "./blockDetailGeometry";
import { Balconies, type Face } from "./cruiseParts";
import GlowSurface from "./GlowSurface";
import { AdditiveGlow } from "./GlowShapes";
import { isWindowLit, WINDOW_GLOW, windowGroupOf } from "./lightColors";
import { PALETTE } from "./palette";
import Surface, { type PartEmphasis, type PartTint } from "./Surface";

interface BlockDetailsProps {
  def: GridPartDef;
  size: BlockSize;
  height: number;
  tint: PartTint;
  emphasis: PartEmphasis;
  /** Faces to give a balcony, for balcony cabins. */
  balconyFaces?: Face[];
  /** Varies which windows are lit from block to block; fixed per block. */
  seed?: number;
}

/** Trim that stands just proud of the 0.96 body, so it never z-fights. */
/** Peak opacity of the bloom around each lit window. */
const WINDOW_HALO_OPACITY = 0.32;
const TRIM_SCALE = 0.975;
const CLASS_STRIPE_Y = 0.3;
const CLASS_STRIPE_HEIGHT = 0.07;
const DECK_LINE_HEIGHT = 0.03;

/**
 * Windows and trim on a grid block's body: windows on every face of a cabin
 * (with its class colour as a stripe), a window band on the bridge, and a
 * subtle deck line on plain blocks.
 */
export default function BlockDetails({
  def,
  size,
  height,
  tint,
  emphasis,
  balconyFaces,
  seed = 0,
}: BlockDetailsProps) {
  const surface = { tint, emphasis };
  const isBridge = def.role === "bridge";
  const { x: sizeX, z: sizeZ } = size;
  const stripeColor = def.passengers
    ? PALETTE.cabin[def.passengers.cabinClass]
    : def.crewBerths
      ? PALETTE.cabin.crew
      : null;
  const hasWindows = isBridge || stripeColor !== null;
  const windowGlow = WINDOW_GLOW[windowGroupOf(def) ?? "bridge"];
  const { litFraction } = windowGlow;
  const windows = useMemo(
    () =>
      hasWindows
        ? buildWindowGeometries(
            { x: sizeX, z: sizeZ },
            isBridge ? BRIDGE_WINDOW_ROWS : CABIN_WINDOW_ROWS,
            (index) => isWindowLit(index, litFraction, seed)
          )
        : null,
    [hasWindows, isBridge, sizeX, sizeZ, litFraction, seed]
  );
  useEffect(
    () => () => {
      windows?.glass?.dispose();
      windows?.litGlass?.dispose();
      windows?.litHalo?.dispose();
      windows?.frames.dispose();
    },
    [windows]
  );

  return (
    <>
      {balconyFaces && (
        <Balconies faces={balconyFaces} tint={tint} emphasis={emphasis} />
      )}
      {windows && (
        <>
          <mesh geometry={windows.frames}>
            <Surface color={PALETTE.windowFrame} {...surface} />
          </mesh>
          {windows.glass && (
            <mesh geometry={windows.glass}>
              <Surface color={PALETTE.bridgeWindows} {...surface} />
            </mesh>
          )}
          {windows.litGlass && (
            <mesh geometry={windows.litGlass}>
              <GlowSurface
                color={PALETTE.bridgeWindows}
                glowColor={windowGlow.color}
                strength={windowGlow.strength}
                {...surface}
              />
            </mesh>
          )}
          {windows.litHalo && !tint && (
            <AdditiveGlow
              geometry={windows.litHalo}
              color={windowGlow.color}
              strength={WINDOW_HALO_OPACITY}
              vertexColors={false}
            />
          )}
        </>
      )}
      {stripeColor && (
        <mesh position={[0, CLASS_STRIPE_Y, 0]}>
          <boxGeometry
            args={[
              size.x * TRIM_SCALE,
              CLASS_STRIPE_HEIGHT,
              size.z * TRIM_SCALE,
            ]}
          />
          <Surface color={stripeColor} {...surface} />
        </mesh>
      )}
      {!stripeColor && (
        <mesh position={[0, height - 0.07, 0]}>
          <boxGeometry
            args={[size.x * TRIM_SCALE, DECK_LINE_HEIGHT, size.z * TRIM_SCALE]}
          />
          <Surface color={PALETTE.deckLine} {...surface} />
        </mesh>
      )}
    </>
  );
}
