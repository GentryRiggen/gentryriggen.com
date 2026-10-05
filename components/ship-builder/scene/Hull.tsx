"use client";

import { useEffect, useMemo } from "react";
import { Color, Mesh, type BufferGeometry } from "three";
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
import { AO_OCCLUDER } from "./aoLayer";
import IcebergAimLayer from "./IcebergAimLayer";
import { shouldSwallowClick } from "./clickGuard";
import { BOOT_TOP, DECK_Y, HULL_DRAFT } from "./coords";
import {
  bandHeights,
  buildEndGeometry,
  buildMiddleGeometry,
} from "./hullGeometry";
import {
  BULB_PROTRUSION,
  bowFlare,
  endSectionAt,
  hullHalfWidth,
  type EndKind,
} from "./hullShapes";
import {
  DECK_PLATE,
  buildBulwarkGeometry,
  buildHullBand,
  type HullPlan,
} from "./hullTrim";
import HullDetails from "./HullDetails";
import { noRaycast } from "./noRaycast";
import { PALETTE } from "./palette";
import { FINISHES } from "./Surface";

/** The bulb sits low and entirely under the waterline. */
const BULB_Y = -0.9;
const BULB_RADII = [1, 0.55, 0.5] as const;
/** The bulb's centre sits this far behind the stem's tip. */
const BULB_SETBACK = 0.3;

/** The dark band along the waterline where the red meets the topsides. */
const BOOT_TOP_COLOR = "#161d27";
const BOOT_TOP_BAND = [
  { y: BOOT_TOP - 0.035, out: 0.006 },
  { y: BOOT_TOP + 0.045, out: 0.006 },
] as const;
/** A small rounded rubbing strake along each side, above the boot top. */
const STRAKE_BAND = [
  { y: 0.35, out: 0.004 },
  { y: 0.37, out: 0.016 },
  { y: 0.4, out: 0.024 },
  { y: 0.43, out: 0.016 },
  { y: 0.45, out: 0.004 },
] as const;

const PAINT = FINISHES.paint;

interface HullProps {
  lengthCells: number;
  beam: number;
  bow: BowShape;
  stern: SternShape;
  paint?: HullData["paint"];
}

/** The slices a piece of hull is built from, and how wide each one is. */
interface SectionProfile {
  heights: number[];
  halfWidthAt: (y: number) => number;
}

/** The deck plate's top edge rolls over a quarter circle. */
function deckPlateProfile(halfBeam: number): SectionProfile {
  const radius = DECK_PLATE;
  const heights = [0, 30, 60, 90].map(
    (degrees) => DECK_Y + radius * Math.sin((degrees * Math.PI) / 180)
  );
  return {
    heights,
    halfWidthAt: (y) => {
      const rise = Math.min(radius, Math.max(0, y - DECK_Y));
      return halfBeam - radius + Math.sqrt(radius * radius - rise * rise);
    },
  };
}

function bandProfile(
  halfBeam: number,
  bottom: number,
  top: number
): SectionProfile {
  return {
    heights: bandHeights(bottom, top),
    halfWidthAt: (y) => hullHalfWidth(y, halfBeam),
  };
}

interface PieceProps {
  lengthCells: number;
  beam: number;
  bottom: number;
  top: number;
  color: string;
  /** The deck plate: a thin slab with a rounded edge and a top face. */
  isDeck?: boolean;
  hasBottomCap?: boolean;
  /** Set in paint mode: a tap on the mesh paints its band. */
  onTap?: (event: ThreeEvent<MouseEvent>) => void;
}

interface EndMeshProps extends PieceProps {
  kind: EndKind;
  shape: BowShape | SternShape;
}

function profileOf({
  beam,
  bottom,
  top,
  isDeck = false,
}: Pick<PieceProps, "beam" | "bottom" | "top" | "isDeck">): SectionProfile {
  return isDeck
    ? deckPlateProfile(beam / 2)
    : bandProfile(beam / 2, bottom, top);
}

/** Builds the end's geometry once per input and frees the old one. */
function useEndGeometry(props: EndMeshProps): BufferGeometry {
  const {
    kind,
    shape,
    lengthCells,
    beam,
    bottom,
    top,
    isDeck = false,
    hasBottomCap = false,
  } = props;
  const geometry = useMemo(() => {
    const length =
      kind === "bow"
        ? bowLength(shape as BowShape)
        : sternLength(shape as SternShape);
    const { heights, halfWidthAt } = profileOf({ beam, bottom, top, isDeck });
    return buildEndGeometry({
      // The deck plate is cut flat at deck level, so it matches the plan view.
      sectionAt: (y) => endSectionAt(kind, shape, length, isDeck ? DECK_Y : y),
      halfWidthAt,
      flare: kind === "bow" ? bowFlare : undefined,
      heights,
      originX: ((kind === "bow" ? 1 : -1) * lengthCells) / 2,
      isStern: kind === "stern",
      hasBottomCap,
      hasTopCap: isDeck,
    });
  }, [kind, shape, lengthCells, beam, bottom, top, isDeck, hasBottomCap]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

function useMiddleGeometry(
  props: Omit<PieceProps, "color" | "onTap">
): BufferGeometry {
  const { lengthCells, beam, bottom, top, isDeck = false } = props;
  const hasBottomCap = props.hasBottomCap ?? false;
  const geometry = useMemo(() => {
    const { heights, halfWidthAt } = profileOf({ beam, bottom, top, isDeck });
    return buildMiddleGeometry({
      halfWidthAt,
      heights,
      length: lengthCells,
      hasBottomCap,
      hasTopCap: isDeck,
    });
  }, [lengthCells, beam, bottom, top, isDeck, hasBottomCap]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

function HullMaterial({ color }: { color: string }) {
  return (
    <meshStandardMaterial
      color={color}
      roughness={PAINT.roughness}
      metalness={PAINT.metalness}
    />
  );
}

function PieceMesh({
  geometry,
  color,
  isDeck,
  onTap,
}: {
  geometry: BufferGeometry;
  color: string;
  isDeck?: boolean;
  onTap?: PieceProps["onTap"];
}) {
  return (
    <mesh
      {...AO_OCCLUDER}
      geometry={geometry}
      castShadow={!isDeck}
      receiveShadow
      raycast={onTap ? Mesh.prototype.raycast : noRaycast}
      onClick={onTap}
    >
      <HullMaterial color={color} />
    </mesh>
  );
}

function EndMesh(props: EndMeshProps) {
  const geometry = useEndGeometry(props);
  return (
    <PieceMesh
      geometry={geometry}
      color={props.color}
      isDeck={props.isDeck}
      onTap={props.onTap}
    />
  );
}

function MiddleMesh(props: PieceProps) {
  const geometry = useMiddleGeometry(props);
  return (
    <PieceMesh
      geometry={geometry}
      color={props.color}
      isDeck={props.isDeck}
      onTap={props.onTap}
    />
  );
}

interface HullBandProps extends PieceProps {
  bow: BowShape;
  stern: SternShape;
}

/** One colour band: the middle section plus a lofted bow and stern. */
function HullBand({ bow, stern, ...piece }: HullBandProps) {
  return (
    <group>
      <MiddleMesh {...piece} />
      <EndMesh {...piece} kind="bow" shape={bow} />
      <EndMesh {...piece} kind="stern" shape={stern} />
    </group>
  );
}

/** A thin tan plate over the whole hull top, with a rounded edge. */
function DeckPlate({ lengthCells, beam, bow, stern }: HullProps) {
  return (
    <HullBand
      lengthCells={lengthCells}
      beam={beam}
      bottom={DECK_Y}
      top={DECK_Y + DECK_PLATE}
      color={PALETTE.deck}
      bow={bow}
      stern={stern}
      isDeck
    />
  );
}

/** A shade that stands out from the given paint, light or dark. */
function contrastShade(color: string): string {
  const base = new Color(color);
  const { l } = base.getHSL({ h: 0, s: 0, l: 0 });
  return base.offsetHSL(0, 0, l < 0.4 ? 0.2 : -0.16).getStyle();
}

interface HullTrimProps {
  plan: HullPlan;
  topsidesColor: string;
  onTap?: PieceProps["onTap"];
}

/**
 * The bulwark sweep (painted like the topsides), the rubbing strake and the
 * dark boot-top stripe. Three merged meshes for the whole hull.
 */
function HullTrim({ plan, topsidesColor, onTap }: HullTrimProps) {
  const { lengthCells, beam, bow, stern } = plan;
  const geometries = useMemo(() => {
    const hull = { lengthCells, beam, bow, stern };
    return {
      bulwark: buildBulwarkGeometry(hull),
      strake: buildHullBand(hull, STRAKE_BAND),
      bootTop: buildHullBand(hull, BOOT_TOP_BAND),
    };
  }, [lengthCells, beam, bow, stern]);
  useEffect(
    () => () => {
      geometries.bulwark.dispose();
      geometries.strake.dispose();
      geometries.bootTop.dispose();
    },
    [geometries]
  );
  const strakeColor = useMemo(
    () => contrastShade(topsidesColor),
    [topsidesColor]
  );
  return (
    <group>
      <PieceMesh
        geometry={geometries.bulwark}
        color={topsidesColor}
        onTap={onTap}
      />
      <mesh
        geometry={geometries.strake}
        receiveShadow
        raycast={onTap ? Mesh.prototype.raycast : noRaycast}
        onClick={onTap}
      >
        <HullMaterial color={strakeColor} />
      </mesh>
      <mesh geometry={geometries.bootTop} raycast={noRaycast}>
        <HullMaterial color={BOOT_TOP_COLOR} />
      </mesh>
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
      {...AO_OCCLUDER}
      castShadow
      raycast={noRaycast}
    >
      <sphereGeometry args={[1, 20, 14]} />
      <HullMaterial color={color} />
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
  const isAiming = useShipBuilderStore((s) => s.trial.status === "aiming");
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
  const plan = useMemo(
    () => ({ lengthCells, beam, bow, stern }),
    [lengthCells, beam, bow, stern]
  );
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
        hasBottomCap
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
      <HullTrim
        plan={plan}
        topsidesColor={topsidesColor}
        onTap={tapFor("topsides")}
      />
      {bow === "bulbous" && (
        <Bulb lengthCells={lengthCells} color={bottomColor} />
      )}
      <HullDetails lengthCells={lengthCells} beam={beam} bow={bow} />
      {isAiming && <IcebergAimLayer lengthCells={lengthCells} beam={beam} />}
    </group>
  );
}
