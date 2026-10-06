"use client";

import { useEffect, useMemo } from "react";
import { sidesKey, type BlockSides } from "@/lib/ship-builder/model/blockSides";
import type { GridPartDef } from "@/lib/ship-builder/model/types";
import {
  BRIDGE_WINDOW_ROWS,
  buildWindowGeometries,
  CABIN_WINDOW_ROWS,
  trimBand,
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
  /** Sides joined to a neighbouring block: they get no windows or trim. */
  joined: BlockSides;
  /** Faces to give a balcony, for balcony cabins. */
  balconyFaces?: Face[];
  /** Varies which windows are lit from block to block; fixed per block. */
  seed?: number;
}

/** Peak opacity of the bloom around each lit window. */
const WINDOW_HALO_OPACITY = 0.32;
/** A bridge's glass and band: darker than a cabin's panes. */
const BRIDGE_GLASS = "#1b2733";
const CLASS_STRIPE_Y = 0.3;
const CLASS_STRIPE_HEIGHT = 0.07;
const DECK_LINE_HEIGHT = 0.03;
/** Below the roof, clear of the body's rounded top edge. */
const DECK_LINE_DROP = 0.1;

/**
 * Windows and trim on a grid block's body: windows on every face of a cabin
 * (with its class colour as a stripe), a window band on the bridge, and a
 * subtle deck line on plain blocks.
 */
export default function BlockDetails({
  def,
  size,
  height,
  joined,
  tint,
  emphasis,
  balconyFaces,
  seed = 0,
}: BlockDetailsProps) {
  const surface = { tint, emphasis };
  const isBridge = def.role === "bridge";
  const { x: sizeX, z: sizeZ } = size;
  // The captain's cabin is oak with stern windows only (CaptainCabinTrim), so
  // it skips the class stripe and the all-round cabin windows.
  const isCaptainCabin = def.type === "cabin-captain";
  const stripeColor = isCaptainCabin
    ? null
    : def.passengers
      ? PALETTE.cabin[def.passengers.cabinClass]
      : def.crewBerths
        ? PALETTE.cabin.crew
        : null;
  const hasWindows = isBridge || stripeColor !== null;
  const windowGlow = WINDOW_GLOW[windowGroupOf(def) ?? "bridge"];
  const { litFraction } = windowGlow;
  const joinedKey = sidesKey(joined);
  const hasExposedWall =
    !joined.bow || !joined.stern || !joined.starboard || !joined.port;
  const windows = useMemo(
    () =>
      hasWindows
        ? buildWindowGeometries(
            { x: sizeX, z: sizeZ },
            isBridge ? BRIDGE_WINDOW_ROWS : CABIN_WINDOW_ROWS,
            (index) => isWindowLit(index, litFraction, seed),
            isBridge ? height : undefined,
            joined
          )
        : null,
    // `joinedKey` stands for the mask, which is a fresh object each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hasWindows, isBridge, sizeX, sizeZ, height, litFraction, seed, joinedKey]
  );
  useEffect(
    () => () => {
      windows?.glass?.dispose();
      windows?.litGlass?.dispose();
      windows?.litHalo?.dispose();
      windows?.frames?.dispose();
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
          {windows.frames && (
            <mesh geometry={windows.frames}>
              <Surface color={PALETTE.windowFrame} {...surface} />
            </mesh>
          )}
          {windows.glass && (
            <mesh geometry={windows.glass}>
              <Surface
                color={isBridge ? BRIDGE_GLASS : PALETTE.bridgeWindows}
                finish="glass"
                {...surface}
              />
            </mesh>
          )}
          {windows.litGlass && (
            <mesh geometry={windows.litGlass}>
              <GlowSurface
                color={isBridge ? BRIDGE_GLASS : PALETTE.bridgeWindows}
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
      {stripeColor && hasExposedWall && (
        <mesh
          position={[0, CLASS_STRIPE_Y, 0]}
          geometry={trimBand(size, CLASS_STRIPE_HEIGHT, joined)}
        >
          <Surface color={stripeColor} {...surface} />
        </mesh>
      )}
      {!stripeColor && hasExposedWall && (
        <mesh
          position={[0, height - DECK_LINE_DROP, 0]}
          geometry={trimBand(size, DECK_LINE_HEIGHT, joined)}
        >
          <Surface color={PALETTE.deckLine} {...surface} />
        </mesh>
      )}
    </>
  );
}
