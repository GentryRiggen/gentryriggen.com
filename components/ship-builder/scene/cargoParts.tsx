"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BoxGeometry,
  SphereGeometry,
  type BufferGeometry,
  type Group,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  containerColor,
  paintHex,
  type PaintColor,
} from "@/lib/ship-builder/model/paint";
import { MAX_FRAME_DELTA } from "./animationMath";
import { frozenTime } from "./testClock";
import { LEVEL_HEIGHT } from "./coords";
import { roundedBox } from "./roundedBox";
import { PALETTE } from "./palette";
import { useShipAnimation } from "./ShipAnimationContext";
import { AO_OCCLUDER } from "./aoLayer";
import Surface, { type PartEmphasis, type PartTint } from "./Surface";

interface CargoMeshProps {
  tint: PartTint;
  emphasis: PartEmphasis;
}

function isGhost(tint: PartTint): boolean {
  return tint === "ghost-ok" || tint === "ghost-bad";
}

function box(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number
): BoxGeometry {
  const geometry = new BoxGeometry(w, h, d);
  geometry.translate(x, y, z);
  return geometry;
}

// ---------------------------------------------------------------- containers

/** A container fills 0.96 of its 2×1 footprint, with a seam below and above. */
const CONTAINER_LENGTH = 1.92;
const CONTAINER_WIDTH = 0.94;
const CONTAINER_HEIGHT = 0.94;
const CONTAINER_BASE = (LEVEL_HEIGHT - CONTAINER_HEIGHT) / 2;
const RIB_COUNT = 14;
const RIB_DEPTH = 0.035;

interface ContainerGeometry {
  body: BufferGeometry;
  ribs: BufferGeometry;
  doors: BufferGeometry;
}

/**
 * Built once and shared by every container: a stack of forty containers is
 * then three draw calls each rather than dozens. They live for the whole
 * session, so they are never disposed.
 */
let sharedContainer: ContainerGeometry | undefined;

function getContainerGeometry(): ContainerGeometry {
  if (sharedContainer) return sharedContainer;
  const midY = CONTAINER_BASE + CONTAINER_HEIGHT / 2;
  const ribHeight = CONTAINER_HEIGHT - 0.12;
  const ribs: BoxGeometry[] = [];
  // Corrugation: shallow vertical ridges along both long sides, leaving the
  // door end clear.
  const span = CONTAINER_LENGTH - 0.3;
  for (let i = 0; i < RIB_COUNT; i++) {
    const x = -span / 2 + (span * i) / (RIB_COUNT - 1);
    for (const side of [-1, 1]) {
      ribs.push(
        box(
          0.05,
          ribHeight,
          RIB_DEPTH,
          x,
          midY,
          side * (CONTAINER_WIDTH / 2 + RIB_DEPTH / 2 - 0.005)
        )
      );
    }
  }
  // Roof rails, so the ridges read as panels.
  for (const side of [-1, 1]) {
    ribs.push(
      box(
        CONTAINER_LENGTH,
        0.04,
        0.05,
        0,
        CONTAINER_BASE + CONTAINER_HEIGHT - 0.02,
        side * (CONTAINER_WIDTH / 2)
      )
    );
  }

  // Door end (local -X): two locking bars and a door frame.
  const doorX = -CONTAINER_LENGTH / 2 - 0.012;
  const doors: BoxGeometry[] = [];
  for (const z of [-0.17, 0.17]) {
    doors.push(box(0.03, ribHeight, 0.035, doorX, midY, z));
  }
  doors.push(box(0.03, 0.04, CONTAINER_WIDTH - 0.1, doorX, midY, 0));
  doors.push(box(0.03, 0.04, 0.34, doorX, midY + 0.18, 0));
  doors.push(box(0.025, ribHeight + 0.04, 0.025, doorX, midY, 0));

  sharedContainer = {
    // The cached rounded box is shared, so copy it before moving it up.
    body: roundedBox(CONTAINER_LENGTH, CONTAINER_HEIGHT, CONTAINER_WIDTH, 0.035)
      .clone()
      .translate(0, midY, 0),
    ribs: mergeGeometries(ribs),
    doors: mergeGeometries(doors),
  };
  for (const part of [...ribs, ...doors]) part.dispose();
  return sharedContainer;
}

interface ContainerMeshProps extends CargoMeshProps {
  /** The part's id, which picks its colour; absent for ghosts. */
  partId?: string;
  color?: PaintColor;
  /** Quarter turns of the part, so the long axis and door end follow it. */
  rotation: 0 | 90 | 180 | 270;
}

/** A corrugated shipping container with doors on one end. */
export function ContainerMesh({
  partId,
  color,
  rotation,
  tint,
  emphasis,
}: ContainerMeshProps) {
  const geometry = getContainerGeometry();
  const surface = { tint, emphasis };
  const hex = paintHex(containerColor(partId ?? "", color));
  return (
    <group rotation={[0, (rotation * Math.PI) / 180, 0]}>
      <mesh {...AO_OCCLUDER} geometry={geometry.body} castShadow receiveShadow>
        <Surface color={hex} {...surface} />
      </mesh>
      <mesh geometry={geometry.ribs} castShadow>
        <Surface color={hex} {...surface} />
      </mesh>
      <mesh geometry={geometry.doors}>
        <Surface color={PALETTE.containerSteel} finish="metal" {...surface} />
      </mesh>
    </group>
  );
}

// -------------------------------------------------------------- hatch covers

/**
 * Levels are a fixed unit tall, so a container on a hatch cover sits one whole
 * level up. The cover is drawn as a raised coaming under a thin lid whose top
 * is at that level, so the container visibly rests on it.
 */
const HATCH_LID = 0.3;
const HATCH_COAMING = LEVEL_HEIGHT - HATCH_LID;

interface HatchCoverMeshProps extends CargoMeshProps {
  size: { x: number; z: number };
  color?: PaintColor;
}

export function HatchCoverMesh({
  size,
  color,
  tint,
  emphasis,
}: HatchCoverMeshProps) {
  const surface = { tint, emphasis };
  const lidColor = color ? paintHex(color) : PALETTE.hatchCover;
  return (
    <group>
      <mesh
        {...AO_OCCLUDER}
        position={[0, HATCH_COAMING / 2, 0]}
        castShadow
        receiveShadow
      >
        <primitive
          object={roundedBox(size.x * 0.88, HATCH_COAMING, size.z * 0.88, 0.05)}
          attach="geometry"
        />
        <Surface color={PALETTE.hatchCoaming} {...surface} />
      </mesh>
      <mesh
        {...AO_OCCLUDER}
        position={[0, HATCH_COAMING + HATCH_LID / 2, 0]}
        castShadow
        receiveShadow
      >
        <primitive
          object={roundedBox(size.x * 0.96, HATCH_LID, size.z * 0.96, 0.06)}
          attach="geometry"
        />
        <Surface color={lidColor} {...surface} />
      </mesh>
      <mesh position={[0, LEVEL_HEIGHT + 0.005, 0]}>
        <boxGeometry args={[size.x * 0.9, 0.012, 0.05]} />
        <Surface color={PALETTE.hatchCoaming} {...surface} />
      </mesh>
      <mesh position={[0, LEVEL_HEIGHT + 0.005, 0]}>
        <boxGeometry args={[0.05, 0.012, size.z * 0.9]} />
        <Surface color={PALETTE.hatchCoaming} {...surface} />
      </mesh>
    </group>
  );
}

// -------------------------------------------------------------- cargo crane

const PEDESTAL_HEIGHT = 1.1;
const JIB_LENGTH = 2.3;
const JIB_TILT = 0.45;
/** Radians per second of the swing's phase, and how far it swings either way. */
const SWING_RATE = 0.35;
const SWING_RANGE = 1.1;
const CRANE_REST_ANGLE = 0.5;

interface CargoCraneMeshProps extends CargoMeshProps {
  color?: string;
}

/** A pedestal crane whose jib slowly swings back and forth over the deck. */
export function CargoCraneMesh({ color, tint, emphasis }: CargoCraneMeshProps) {
  const surface = { tint, emphasis };
  const body = color ?? PALETTE.crane;
  const slew = useRef<Group>(null);
  const phase = useRef(0);
  const { reducedMotion } = useShipAnimation();
  const isAnimated = !reducedMotion && !isGhost(tint);

  useFrame((_, delta) => {
    const group = slew.current;
    if (!isAnimated || !group) return;
    const frozen = frozenTime();
    phase.current =
      frozen !== null
        ? frozen * SWING_RATE
        : phase.current + Math.min(delta, MAX_FRAME_DELTA) * SWING_RATE;
    group.rotation.y = CRANE_REST_ANGLE + Math.sin(phase.current) * SWING_RANGE;
  });

  const tipX = JIB_LENGTH * Math.cos(JIB_TILT);
  const tipY = 0.35 + JIB_LENGTH * Math.sin(JIB_TILT);
  const cableLength = 0.9;
  return (
    <group>
      <mesh {...AO_OCCLUDER} position={[0, 0.04, 0]} castShadow>
        <cylinderGeometry args={[0.34, 0.38, 0.08, 20]} />
        <Surface color={PALETTE.hatchCover} {...surface} />
      </mesh>
      <mesh {...AO_OCCLUDER} position={[0, PEDESTAL_HEIGHT / 2, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.26, PEDESTAL_HEIGHT, 20]} />
        <Surface color={body} {...surface} />
      </mesh>
      <group
        ref={slew}
        position={[0, PEDESTAL_HEIGHT, 0]}
        rotation={[0, CRANE_REST_ANGLE, 0]}
      >
        <mesh position={[0, 0.2, 0]} castShadow>
          <primitive
            object={roundedBox(0.5, 0.4, 0.42, 0.06)}
            attach="geometry"
          />
          <Surface color={body} {...surface} />
        </mesh>
        <mesh position={[0.12, 0.28, 0.215]}>
          <boxGeometry args={[0.18, 0.14, 0.01]} />
          <Surface color={PALETTE.bridgeWindows} {...surface} />
        </mesh>
        <mesh position={[-0.42, 0.2, 0]} castShadow>
          <primitive
            object={roundedBox(0.4, 0.3, 0.38, 0.05)}
            attach="geometry"
          />
          <Surface color={PALETTE.containerSteel} finish="metal" {...surface} />
        </mesh>
        <group position={[0, 0.35, 0]} rotation={[0, 0, JIB_TILT]}>
          <mesh position={[JIB_LENGTH / 2, 0, 0]} castShadow>
            <primitive
              object={roundedBox(JIB_LENGTH, 0.1, 0.12, 0.03)}
              attach="geometry"
            />
            <Surface color={body} {...surface} />
          </mesh>
        </group>
        <mesh position={[tipX, tipY - cableLength / 2, 0]}>
          <cylinderGeometry args={[0.02, 0.02, cableLength, 6]} />
          <Surface color={PALETTE.containerSteel} finish="metal" {...surface} />
        </mesh>
        <mesh position={[tipX, tipY - cableLength - 0.04, 0]}>
          <primitive
            object={roundedBox(0.14, 0.08, 0.14, 0.02)}
            attach="geometry"
          />
          <Surface color={PALETTE.containerSteel} finish="metal" {...surface} />
        </mesh>
      </group>
    </group>
  );
}

// ------------------------------------------------------------ freefall boat

const RAMP_LENGTH = 2.6;
const RAMP_TILT = 0.38;
const RAMP_WIDTH = 0.8;
/** Sits the ramp's low (aft) end on the deck line. */
const RAMP_CENTRE_Y = (RAMP_LENGTH / 2) * Math.sin(RAMP_TILT);

let sharedBoatHull: BufferGeometry | undefined;

function getBoatHull(): BufferGeometry {
  sharedBoatHull ??= new SphereGeometry(0.5, 18, 10);
  return sharedBoatHull;
}

/**
 * An enclosed orange boat on a ramp that slopes down toward the stern. Local
 * -X is aft (see modelToWorld), so the ramp's low end is at -X.
 */
export function FreefallBoatMesh({
  color,
  tint,
  emphasis,
}: CargoMeshProps & { color?: string }) {
  const surface = { tint, emphasis };
  const boatColor = color ?? PALETTE.freefallBoat;
  return (
    <group>
      <group position={[0, RAMP_CENTRE_Y, 0]} rotation={[0, 0, RAMP_TILT]}>
        <mesh position={[0, 0, 0]} castShadow>
          <boxGeometry args={[RAMP_LENGTH, 0.08, RAMP_WIDTH]} />
          <Surface color={PALETTE.freefallRamp} {...surface} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[0, 0.09, side * (RAMP_WIDTH / 2)]}>
            <boxGeometry args={[RAMP_LENGTH, 0.1, 0.05]} />
            <Surface color={PALETTE.freefallRamp} {...surface} />
          </mesh>
        ))}
        <mesh
          geometry={getBoatHull()}
          position={[0, 0.34, 0]}
          scale={[1.7, 0.6, 0.6]}
          castShadow
        >
          <Surface color={boatColor} {...surface} />
        </mesh>
        <mesh position={[-0.5, 0.52, 0]}>
          <boxGeometry args={[0.28, 0.1, 0.34]} />
          <Surface color={PALETTE.bridgeWindows} {...surface} />
        </mesh>
        <mesh position={[0.3, 0.64, 0]}>
          <boxGeometry args={[0.2, 0.06, 0.2]} />
          <Surface color={PALETTE.containerSteel} {...surface} />
        </mesh>
      </group>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[0.7, RAMP_CENTRE_Y / 2 + 0.2, side * (RAMP_WIDTH / 2)]}
        >
          <boxGeometry args={[0.06, RAMP_CENTRE_Y + 0.4, 0.06]} />
          <Surface color={PALETTE.freefallRamp} {...surface} />
        </mesh>
      ))}
    </group>
  );
}
