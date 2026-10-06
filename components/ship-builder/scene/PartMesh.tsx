"use client";

import { memo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import {
  aerialTarget,
  resolveAttachPoint,
  stringTarget,
} from "@/lib/ship-builder/model/attach";
import { analyzeShip } from "@/lib/ship-builder/model/analysis";
import {
  joinedSides,
  NO_JOINED_SIDES,
  type BlockSides,
} from "@/lib/ship-builder/model/blockSides";
import { getPartDef } from "@/lib/ship-builder/model/catalog";
import {
  beamOf,
  gridLength,
  rotatedFootprint,
  type Occupancy,
} from "@/lib/ship-builder/model/grid";
import { paintHex, type PaintColor } from "@/lib/ship-builder/model/paint";
import type { PartCandidate } from "@/lib/ship-builder/model/placement";
import type {
  GridPartDef,
  PartType,
  Ship,
  Side,
  Vec3,
} from "@/lib/ship-builder/model/types";
import { footprintBase, LEVEL_HEIGHT, modelToWorld } from "./coords";
import { AO_OCCLUDER } from "./aoLayer";
import BlockDetails from "./BlockDetails";
import { blockBody } from "./blockBody";
import {
  Azipod,
  ClimbingWall,
  EnclosedLifeboat,
  ModernFunnel,
  openFaces,
  PoolMesh,
  RaftCanister,
  Waterslide,
} from "./cruiseParts";
import { DeckDecorMesh } from "./deckDecor";
import DavitMesh from "./DavitMesh";
import {
  CrowsNestMesh,
  DomeMesh,
  MastMesh,
  SearchlightMesh,
  SternFlagMesh,
  WirelessAerialMesh,
} from "./fittingDecor";
import FunnelMesh from "./FunnelMesh";
import LifeboatMesh from "./LifeboatMesh";
import {
  HelicopterMesh,
  HelipadMesh,
  RadarMastMesh,
  RibBoatMesh,
  TurretMesh,
} from "./navyParts";
import {
  CargoCraneMesh,
  ContainerMesh,
  FreefallBoatMesh,
  HatchCoverMesh,
} from "./cargoParts";
import type { Face } from "./cruiseParts";
import {
  NavLightsMesh,
  StringLightsMesh,
  UnderwaterLightMesh,
} from "./lightParts";
import { PALETTE } from "./palette";
import { CaptainCabinTrim, HelmWheelMesh } from "./pirate/deco";
import { isPirateFitting, renderPirateFitting } from "./pirate/registry";
import Spinner from "./Spinner";
import Surface, { type PartEmphasis, type PartTint } from "./Surface";

export type { PartEmphasis, PartTint };

interface PartMeshProps {
  ship: Ship;
  part: PartCandidate;
  /**
   * Tags the group's `userData.partId`, so one shared set of handlers can tell
   * which part an event hit via `event.eventObject`.
   */
  partId?: string;
  /** The ship's occupancy, shared across parts so each doesn't rebuild it. */
  occupancy?: Occupancy;
  /** Paint on the part's main surface; absent means the default look. */
  color?: PaintColor;
  tint?: PartTint;
  emphasis?: PartEmphasis;
  onPointerOver?: (event: ThreeEvent<PointerEvent>) => void;
  onPointerOut?: (event: ThreeEvent<PointerEvent>) => void;
  onPointerDown?: (event: ThreeEvent<PointerEvent>) => void;
  onClick?: (event: ThreeEvent<MouseEvent>) => void;
}

const BRIDGE_HEIGHT = 0.8;

/** Wooden pirate blocks default to oak instead of white superstructure. */
const WOODEN_BLOCK_COLORS: Partial<Record<PartType, PaintColor>> = {
  "cabin-captain": "oak",
  "helm-wheel": "oak",
};

interface BlockProps {
  def: GridPartDef;
  size: { x: number; z: number };
  /** Sides merged into a neighbouring block: flat, flush, no details. */
  joined: BlockSides;
  color?: PaintColor;
  tint: PartTint;
  emphasis: PartEmphasis;
  /** Balcony faces, for parts that have them. */
  balconyFaces?: Face[];
  /** Varies which windows are lit from one block to the next. */
  seed: number;
}

function Block({
  def,
  size,
  joined,
  color,
  tint,
  emphasis,
  balconyFaces,
  seed,
}: BlockProps) {
  const surface = { tint, emphasis };
  if (def.role === "amenity") {
    return (
      <PoolMesh
        size={size}
        color={color ? paintHex(color) : undefined}
        tint={tint}
        emphasis={emphasis}
      />
    );
  }
  // Blocks fill their level so stacks sit flush and fittings rest on top. The
  // 0.96 footprint inset only holds on exposed sides: joined sides run flush
  // to the cell edge so neighbours read as one wall. The bridge is a lower
  // wheelhouse: nothing stacks or attaches on it.
  const height = def.role === "bridge" ? BRIDGE_HEIGHT : LEVEL_HEIGHT;
  return (
    <group>
      <mesh
        {...AO_OCCLUDER}
        position={[0, height / 2, 0]}
        geometry={blockBody(size, height, joined)}
        castShadow
        receiveShadow
      >
        <Surface
          color={color ? paintHex(color) : PALETTE.superstructure}
          {...surface}
        />
      </mesh>
      <BlockDetails
        def={def}
        size={size}
        height={height}
        joined={joined}
        tint={tint}
        emphasis={emphasis}
        balconyFaces={balconyFaces}
        seed={seed}
      />
    </group>
  );
}

interface FittingProps {
  type: PartType;
  side?: Side;
  color?: PaintColor;
  tint: PartTint;
  emphasis: PartEmphasis;
  /** Offset from the part's origin to the other mast's top, for an aerial. */
  wireTarget?: [number, number, number];
  /** Half the parent bridge's width, for navigation lights. */
  bridgeHalfSpan?: number;
}

function Fitting({
  type,
  side,
  color,
  tint,
  emphasis,
  wireTarget,
  bridgeHalfSpan,
}: FittingProps) {
  const surface = { tint, emphasis };
  const painted = color ? paintHex(color) : undefined;
  // Starboard is world +Z (see coords.ts), so outboard is +Z there.
  const outward = side === "starboard" ? 1 : -1;
  const navy = { painted, tint, emphasis };
  switch (type) {
    case "funnel":
      return (
        <FunnelMesh
          baseRadius={0.42}
          topRadius={0.38}
          bodyHeight={2.6}
          capHeight={0.6}
          bodyColor={painted}
          tint={tint}
          emphasis={emphasis}
        />
      );
    case "funnel-large":
      // Centred on its point (the 2x2's centre, on top): body 3.4 + top 0.8.
      return (
        <FunnelMesh
          baseRadius={0.71}
          topRadius={0.65}
          bodyHeight={3.4}
          capHeight={0.8}
          bodyColor={painted}
          tint={tint}
          emphasis={emphasis}
        />
      );
    case "propeller": {
      // Shaft along world X (the ship's length); blades spread around it.
      const isGhost = tint === "ghost-ok" || tint === "ghost-bad";
      return (
        <Spinner enabled={!isGhost}>
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.12, 0.12, 0.4, 12]} />
            <Surface color={painted ?? PALETTE.propeller} {...surface} />
          </mesh>
          {[0, 1, 2].map((i) => (
            <group key={i} rotation={[(i * 2 * Math.PI) / 3, 0, 0]}>
              <mesh position={[0, 0.32, 0]} castShadow>
                <boxGeometry args={[0.06, 0.5, 0.16]} />
                <Surface color={painted ?? PALETTE.propeller} {...surface} />
              </mesh>
            </group>
          ))}
        </Spinner>
      );
    }
    case "rudder":
      // A flat vertical plate, thin across the ship and long fore-aft.
      return (
        <mesh castShadow>
          <boxGeometry args={[0.6, 0.9, 0.08]} />
          <Surface color={painted ?? PALETTE.propeller} {...surface} />
        </mesh>
      );
    case "mast":
      return <MastMesh {...navy} />;
    case "davit":
      return (
        <DavitMesh
          outward={outward}
          color={painted}
          tint={tint}
          emphasis={emphasis}
        />
      );
    case "lifeboat-large":
      return (
        <LifeboatMesh
          length={1.9}
          width={0.45}
          depth={0.35}
          hullColor={painted ?? PALETTE.lifeboat}
          tint={tint}
          emphasis={emphasis}
        />
      );
    case "lifeboat-standard":
    case "lifeboat-collapsible": {
      const collapsible = type === "lifeboat-collapsible";
      return (
        <LifeboatMesh
          length={0.9}
          width={0.35}
          depth={collapsible ? 0.2 : 0.3}
          hullColor={
            painted ?? (collapsible ? PALETTE.collapsible : PALETTE.lifeboat)
          }
          tint={tint}
          emphasis={emphasis}
        />
      );
    }
    case "turret-small":
    case "turret-large":
      return (
        <TurretMesh
          large={type === "turret-large"}
          painted={painted}
          tint={tint}
          emphasis={emphasis}
        />
      );
    case "radar-mast":
      return <RadarMastMesh {...navy} />;
    case "helipad":
      return <HelipadMesh {...navy} />;
    case "helicopter":
      return <HelicopterMesh {...navy} />;
    case "rib-boat":
      return <RibBoatMesh {...navy} />;
    case "cargo-crane":
      return <CargoCraneMesh color={painted} tint={tint} emphasis={emphasis} />;
    case "lifeboat-freefall":
      return (
        <FreefallBoatMesh color={painted} tint={tint} emphasis={emphasis} />
      );
    case "waterslide":
      return <Waterslide color={painted} tint={tint} emphasis={emphasis} />;
    case "climbing-wall":
      return <ClimbingWall color={painted} tint={tint} emphasis={emphasis} />;
    case "lifeboat-enclosed":
      return (
        <EnclosedLifeboat color={painted} tint={tint} emphasis={emphasis} />
      );
    case "raft-canister":
      return (
        <RaftCanister
          color={painted}
          outward={outward}
          tint={tint}
          emphasis={emphasis}
        />
      );
    case "funnel-modern":
      return <ModernFunnel color={painted} tint={tint} emphasis={emphasis} />;
    case "azipod":
      return <Azipod color={painted} tint={tint} emphasis={emphasis} />;
    case "dome":
      return <DomeMesh {...navy} />;
    case "searchlight":
      return <SearchlightMesh {...navy} />;
    case "crows-nest":
      return <CrowsNestMesh {...navy} />;
    case "stern-flag":
      return (
        <SternFlagMesh
          {...navy}
          isGhost={tint === "ghost-ok" || tint === "ghost-bad"}
        />
      );
    case "wireless-aerial":
      return wireTarget ? (
        <WirelessAerialMesh
          target={wireTarget}
          tint={tint}
          emphasis={emphasis}
        />
      ) : null;
    case "string-lights":
      return wireTarget ? (
        <StringLightsMesh
          target={wireTarget}
          painted={painted}
          tint={tint}
          emphasis={emphasis}
        />
      ) : null;
    case "nav-lights":
      return (
        <NavLightsMesh
          halfSpan={bridgeHalfSpan ?? 1}
          painted={painted}
          tint={tint}
          emphasis={emphasis}
        />
      );
    case "underwater-light":
      return (
        <UnderwaterLightMesh
          side={side ?? "starboard"}
          tint={tint}
          emphasis={emphasis}
        />
      );
    // Grid parts are drawn by PartMesh itself (Block, container, decor...),
    // never as fittings. Listed so a new part type can't be forgotten.
    case "deck-1x1":
    case "deck-2x1":
    case "cabin-1st":
    case "cabin-2nd":
    case "cabin-3rd":
    case "cabin-crew":
    case "cabin-balcony":
    case "bridge-3":
    case "bridge":
    case "bridge-5":
    case "bridge-6":
    case "bridge-7":
    case "container":
    case "hatch-cover":
    case "pool":
    case "deckchair":
    case "bench":
    case "deck-lamp":
    case "floodlight":
    case "ventilator":
    case "stairs":
    case "cabin-captain":
    case "helm-wheel":
    case "ship-anchor":
    case "barrel-stack":
    case "crate-stack":
    case "treasure-chest":
    case "pirate-crew":
    case "parrot":
      return null;
    default:
      return isPirateFitting(type)
        ? renderPirateFitting(type, { painted, tint, emphasis, side })
        : assertNever(type);
  }
}

/** Compile-time exhaustiveness check; renders nothing if it ever runs. */
function assertNever(type: never): null {
  void type;
  return null;
}

type TargetFinder = typeof aerialTarget;

/** Offset from a wire's point to the other end, in world axes. */
function wireTargetOffset(
  ship: Ship,
  parentId: string,
  from: Vec3,
  find: TargetFinder,
  occupancy?: Occupancy
): [number, number, number] | undefined {
  const pole = ship.parts.find((p) => p.id === parentId);
  const top = pole && find(ship, pole, occupancy);
  // World x and z run opposite to model x and z (see modelToWorld).
  return top && [from.x - top.x, top.y - from.y, from.z - top.z];
}

/** Half the width across the ship of the bridge a part sits on, in cells. */
function bridgeHalfSpanOf(ship: Ship, parentId: string): number | undefined {
  const bridge = ship.parts.find((p) => p.id === parentId);
  const def = bridge && getPartDef(bridge.type);
  if (!bridge || def?.placement !== "grid") return undefined;
  return rotatedFootprint(def.footprint, bridge.rotation).z / 2;
}

/** A small number from a block's cell, so each block lights its own windows. */
function windowSeed(anchor: PartCandidate["anchor"]): number {
  return anchor.kind === "grid"
    ? anchor.level * 53 + anchor.x * 31 + anchor.z * 17
    : 0;
}

function PartMesh({
  ship,
  part,
  partId,
  occupancy,
  color,
  tint = null,
  emphasis = null,
  onPointerOver,
  onPointerOut,
  onPointerDown,
  onClick,
}: PartMeshProps) {
  const def = getPartDef(part.type);
  const length = gridLength(ship);
  const beam = beamOf(ship);
  const handlers = {
    onPointerOver,
    onPointerOut,
    onPointerDown,
    onClick,
    userData: { partId },
  };

  if (def.placement === "grid") {
    if (part.anchor.kind !== "grid") return null;
    const { center, size } = footprintBase(def, part.anchor, part.rotation);
    return (
      <group position={modelToWorld(length, beam, center)} {...handlers}>
        {def.role === "decor" ? (
          <DeckDecorMesh
            type={part.type}
            color={color ? paintHex(color) : undefined}
            rotation={part.rotation}
            tint={tint}
            emphasis={emphasis}
          />
        ) : def.role === "cargo" ? (
          <ContainerMesh
            partId={partId}
            color={color}
            rotation={part.rotation}
            tint={tint}
            emphasis={emphasis}
          />
        ) : part.type === "hatch-cover" ? (
          <HatchCoverMesh
            size={size}
            color={color}
            tint={tint}
            emphasis={emphasis}
          />
        ) : (
          <>
            <Block
              def={def}
              size={size}
              joined={
                part.anchor.kind === "grid"
                  ? joinedSides(ship, part, occupancy)
                  : NO_JOINED_SIDES
              }
              color={color ?? WOODEN_BLOCK_COLORS[part.type]}
              tint={tint}
              emphasis={emphasis}
              seed={windowSeed(part.anchor)}
              balconyFaces={
                part.type === "cabin-balcony"
                  ? openFaces(part, occupancy ?? analyzeShip(ship).occupancy)
                  : undefined
              }
            />
            {part.type === "helm-wheel" && (
              <group position={[0, BRIDGE_HEIGHT, 0]}>
                <HelmWheelMesh tint={tint} emphasis={emphasis} />
              </group>
            )}
            {part.type === "cabin-captain" && (
              <CaptainCabinTrim size={size} tint={tint} emphasis={emphasis} />
            )}
          </>
        )}
      </group>
    );
  }

  if (part.anchor.kind !== "attach") return null;
  const point = resolveAttachPoint(ship, part.anchor, occupancy);
  if (!point) return null;
  return (
    <group position={modelToWorld(length, beam, point.position)} {...handlers}>
      <Fitting
        type={part.type}
        side={point.side}
        color={color}
        tint={tint}
        emphasis={emphasis}
        wireTarget={
          part.type === "wireless-aerial" || part.type === "string-lights"
            ? wireTargetOffset(
                ship,
                part.anchor.parentId,
                point.position,
                part.type === "string-lights" ? stringTarget : aerialTarget,
                occupancy
              )
            : undefined
        }
        bridgeHalfSpan={
          part.type === "nav-lights"
            ? bridgeHalfSpanOf(ship, part.anchor.parentId)
            : undefined
        }
      />
    </group>
  );
}

// Not `export default function` like the other components: memo() wraps it.
export default memo(PartMesh);
