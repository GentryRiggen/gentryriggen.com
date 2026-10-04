"use client";

import { useEffect, useMemo } from "react";
import { Mesh, type BufferGeometry } from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { bowLength, sternLength } from "@/lib/ship-builder/model/hullEnds";
import { paintHex, type HullArea } from "@/lib/ship-builder/model/paint";
import type {
  BowShape,
  Hull as HullData,
  SternShape,
} from "@/lib/ship-builder/model/types";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { isTap } from "./anchors";
import { shouldSwallowClick } from "./clickGuard";
import { BOOT_TOP, DECK_Y, HULL_DRAFT } from "./coords";
import { buildEndGeometry } from "./hullGeometry";
import { BULB_PROTRUSION, endSectionAt, type EndKind } from "./hullShapes";
import HullDetails from "./HullDetails";
import { noRaycast } from "./noRaycast";
import { PALETTE } from "./palette";

/** Deck plate thickness; it sits on DECK_Y so its top is DECK_Y + 0.02. */
const DECK_PLATE = 0.02;

/** The bulb sits low and entirely under the waterline. */
const BULB_Y = -0.9;
const BULB_RADII = [1, 0.55, 0.5] as const;
/** The bulb's centre sits this far behind the stem's tip. */
const BULB_SETBACK = 0.3;

interface HullProps {
  lengthCells: number;
  beam: number;
  bow: BowShape;
  stern: SternShape;
  paint?: HullData["paint"];
}

interface EndMeshProps {
  kind: EndKind;
  shape: BowShape | SternShape;
  lengthCells: number;
  beam: number;
  bottom: number;
  top: number;
  color: string;
  /** Slice the end at this height for every row (a flat plate). */
  fixedY?: number;
  hasBottomCap?: boolean;
  isDeck?: boolean;
  /** Set in paint mode: a tap on the mesh paints its band. */
  onTap?: (event: ThreeEvent<MouseEvent>) => void;
}

function endLength(kind: EndKind, shape: BowShape | SternShape): number {
  return kind === "bow"
    ? bowLength(shape as BowShape)
    : sternLength(shape as SternShape);
}

/** Builds the end's geometry once per input and frees the old one. */
function useEndGeometry({
  kind,
  shape,
  lengthCells,
  beam,
  bottom,
  top,
  fixedY,
  hasBottomCap = false,
  isDeck = false,
}: Omit<EndMeshProps, "color" | "onTap">): BufferGeometry {
  const geometry = useMemo(() => {
    const length = endLength(kind, shape);
    return buildEndGeometry({
      sectionAt: (y) => endSectionAt(kind, shape, length, fixedY ?? y),
      halfBeam: beam / 2,
      bottom,
      top,
      originX: ((kind === "bow" ? 1 : -1) * lengthCells) / 2,
      isStern: kind === "stern",
      hasBottomCap,
      hasTopCap: isDeck,
    });
  }, [
    kind,
    shape,
    lengthCells,
    beam,
    bottom,
    top,
    fixedY,
    hasBottomCap,
    isDeck,
  ]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

function EndMesh(props: EndMeshProps) {
  const geometry = useEndGeometry(props);
  return (
    <mesh
      geometry={geometry}
      castShadow={!props.isDeck}
      receiveShadow
      raycast={props.onTap ? Mesh.prototype.raycast : noRaycast}
      onClick={props.onTap}
    >
      <meshStandardMaterial color={props.color} />
    </mesh>
  );
}

interface HullBandProps {
  lengthCells: number;
  beam: number;
  bottom: number;
  top: number;
  color: string;
  bow: BowShape;
  stern: SternShape;
  isKeelBand?: boolean;
  onTap?: (event: ThreeEvent<MouseEvent>) => void;
}

/** One colour band: the straight middle plus a lofted bow and stern. */
function HullBand({
  lengthCells,
  beam,
  bottom,
  top,
  color,
  bow,
  stern,
  isKeelBand = false,
  onTap,
}: HullBandProps) {
  const height = top - bottom;
  const shared = { lengthCells, beam, bottom, top, color, onTap };
  return (
    <group>
      <mesh
        position={[0, bottom + height / 2, 0]}
        castShadow
        receiveShadow
        raycast={onTap ? Mesh.prototype.raycast : noRaycast}
        onClick={onTap}
      >
        <boxGeometry args={[lengthCells, height, beam]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <EndMesh {...shared} kind="bow" shape={bow} hasBottomCap={isKeelBand} />
      <EndMesh
        {...shared}
        kind="stern"
        shape={stern}
        hasBottomCap={isKeelBand}
      />
    </group>
  );
}

/** A thin tan plate over the whole hull top: box, bow and stern. */
function DeckPlate({ lengthCells, beam, bow, stern }: HullProps) {
  const shared = {
    lengthCells,
    beam,
    bottom: DECK_Y,
    top: DECK_Y + DECK_PLATE,
    color: PALETTE.deck,
    fixedY: DECK_Y,
    isDeck: true,
  };
  return (
    <group>
      <mesh position={[0, DECK_Y + DECK_PLATE / 2, 0]} receiveShadow>
        <boxGeometry args={[lengthCells, DECK_PLATE, beam]} />
        <meshStandardMaterial color={PALETTE.deck} />
      </mesh>
      <EndMesh {...shared} kind="bow" shape={bow} />
      <EndMesh {...shared} kind="stern" shape={stern} />
    </group>
  );
}

/** The bulbous bow's bulb: a squashed sphere in the red band. */
function Bulb({ lengthCells, color }: { lengthCells: number; color: string }) {
  const stemTip = bowLength("bulbous") - BULB_PROTRUSION;
  return (
    <mesh
      position={[lengthCells / 2 + stemTip - BULB_SETBACK, BULB_Y, 0]}
      scale={BULB_RADII}
      castShadow
      raycast={noRaycast}
    >
      <sphereGeometry args={[1, 20, 14]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

export default function Hull({
  lengthCells,
  beam,
  bow,
  stern,
  paint,
}: HullProps) {
  const isPainting = useShipBuilderStore((s) => s.tool.kind === "paint");
  const paintHull = useShipBuilderStore((s) => s.paintHull);
  // Bands only take taps in paint mode, so they never block the grid targets
  // sitting on the deck.
  const tapFor = (area: HullArea) =>
    isPainting
      ? (event: ThreeEvent<MouseEvent>) => {
          event.stopPropagation();
          if (shouldSwallowClick() || !isTap(event)) return;
          paintHull(area);
        }
      : undefined;
  const bottomColor = paint?.bottom
    ? paintHex(paint.bottom)
    : PALETTE.antifouling;
  const topsidesColor = paint?.topsides
    ? paintHex(paint.topsides)
    : PALETTE.hull;
  return (
    <group>
      <HullBand
        lengthCells={lengthCells}
        beam={beam}
        bottom={-HULL_DRAFT}
        top={BOOT_TOP}
        color={bottomColor}
        bow={bow}
        stern={stern}
        isKeelBand
        onTap={tapFor("bottom")}
      />
      <HullBand
        lengthCells={lengthCells}
        beam={beam}
        bottom={BOOT_TOP}
        top={DECK_Y}
        color={topsidesColor}
        bow={bow}
        stern={stern}
        onTap={tapFor("topsides")}
      />
      <DeckPlate
        lengthCells={lengthCells}
        beam={beam}
        bow={bow}
        stern={stern}
      />
      {bow === "bulbous" && (
        <Bulb lengthCells={lengthCells} color={bottomColor} />
      )}
      <HullDetails lengthCells={lengthCells} beam={beam} bow={bow} />
    </group>
  );
}
