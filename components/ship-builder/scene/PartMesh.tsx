"use client";

import { memo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { resolveAttachPoint } from "@/lib/ship-builder/model/attach";
import { getPartDef } from "@/lib/ship-builder/model/catalog";
import {
  beamOf,
  buildOccupancy,
  gridLength,
  type Occupancy,
} from "@/lib/ship-builder/model/grid";
import { paintHex, type PaintColor } from "@/lib/ship-builder/model/paint";
import type { PartCandidate } from "@/lib/ship-builder/model/placement";
import type {
  GridPartDef,
  PartType,
  Ship,
  Side,
} from "@/lib/ship-builder/model/types";
import { footprintBase, LEVEL_HEIGHT, modelToWorld } from "./coords";
import BlockDetails from "./BlockDetails";
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
import DavitMesh from "./DavitMesh";
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
import { PALETTE } from "./palette";
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

interface BlockProps {
  def: GridPartDef;
  size: { x: number; z: number };
  color?: PaintColor;
  tint: PartTint;
  emphasis: PartEmphasis;
  /** Balcony faces, for parts that have them. */
  balconyFaces?: Face[];
}

function Block({ def, size, color, tint, emphasis, balconyFaces }: BlockProps) {
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
  // Blocks fill their level so stacks sit flush and fittings rest on top; the
  // 0.96 footprint inset keeps a visible seam between neighbours. The bridge
  // is a lower wheelhouse: nothing stacks or attaches on it.
  const height = def.role === "bridge" ? BRIDGE_HEIGHT : LEVEL_HEIGHT;
  return (
    <group>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[size.x * 0.96, height, size.z * 0.96]} />
        <Surface
          color={color ? paintHex(color) : PALETTE.superstructure}
          {...surface}
        />
      </mesh>
      <BlockDetails
        def={def}
        size={size}
        height={height}
        tint={tint}
        emphasis={emphasis}
        balconyFaces={balconyFaces}
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
}

function Fitting({ type, side, color, tint, emphasis }: FittingProps) {
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
      return (
        <mesh position={[0, 3.5, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.08, 7, 8]} />
          <Surface color={painted ?? PALETTE.mast} {...surface} />
        </mesh>
      );
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
    default:
      return null;
  }
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
        {def.role === "cargo" ? (
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
          <Block
            def={def}
            size={size}
            color={color}
            tint={tint}
            emphasis={emphasis}
            balconyFaces={
              part.type === "cabin-balcony"
                ? openFaces(part, occupancy ?? buildOccupancy(ship))
                : undefined
            }
          />
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
      />
    </group>
  );
}

// Not `export default function` like the other components: memo() wraps it.
export default memo(PartMesh);
