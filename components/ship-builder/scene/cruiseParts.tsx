"use client";

import { BoxGeometry, CatmullRomCurve3, TubeGeometry, Vector3 } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { BufferGeometry } from "three";
import { cellKey, type Occupancy } from "@/lib/ship-builder/model/grid";
import type { PartCandidate } from "@/lib/ship-builder/model/placement";
import { CRUISE_COLORS } from "./cruiseColors";
import { FUNNEL_RAKE_RADIANS } from "./effectAnchors";
import {
  buildModernFunnelBody,
  buildModernFunnelGrille,
} from "./funnelGeometry";
import { getLifeboatGeometry } from "./lifeboatGeometry";
import Spinner from "./Spinner";
import { AO_OCCLUDER } from "./aoLayer";
import Surface, { type PartEmphasis, type PartTint } from "./Surface";

interface CruisePartProps {
  /** Paint colour for the part's main surface, if the player painted it. */
  color?: string;
  tint: PartTint;
  emphasis: PartEmphasis;
}

export type Face = "x+" | "x-" | "z+" | "z-";

/**
 * The faces of a 1×1 block with nothing built beside them, in the block's
 * local (world) axes: world X is the model's x reversed, and so is Z.
 */
export function openFaces(
  part: PartCandidate,
  occupancy: Occupancy | undefined
): Face[] {
  if (part.anchor.kind !== "grid") return [];
  const { level, x, z } = part.anchor;
  const sides: { dx: number; dz: number; face: Face }[] = [
    { dx: -1, dz: 0, face: "x+" },
    { dx: 1, dz: 0, face: "x-" },
    { dx: 0, dz: -1, face: "z+" },
    { dx: 0, dz: 1, face: "z-" },
  ];
  return sides
    .filter(
      ({ dx, dz }) => !occupancy?.has(cellKey({ level, x: x + dx, z: z + dz }))
    )
    .map(({ face }) => face);
}

interface BalconiesProps {
  faces: Face[];
  tint: PartTint;
  emphasis: PartEmphasis;
}

const BALCONY_DEPTH = 0.2;
const BALCONY_Y = 0.33;

/** A small floor slab and glass rail on each given face of a 1×1 cabin. */
export function Balconies({ faces, tint, emphasis }: BalconiesProps) {
  const surface = { tint, emphasis };
  return (
    <>
      {faces.map((face) => {
        const sign = face[1] === "+" ? 1 : -1;
        const isX = face[0] === "x";
        const edge = 0.48 + BALCONY_DEPTH / 2;
        const rotation: [number, number, number] = [
          0,
          isX ? Math.PI / 2 : 0,
          0,
        ];
        const position: [number, number, number] = isX
          ? [sign * edge, BALCONY_Y, 0]
          : [0, BALCONY_Y, sign * edge];
        return (
          <group key={face} position={position} rotation={rotation}>
            <mesh castShadow>
              <boxGeometry args={[0.8, 0.04, BALCONY_DEPTH]} />
              <Surface color={CRUISE_COLORS.balconyFloor} {...surface} />
            </mesh>
            <mesh position={[0, 0.09, BALCONY_DEPTH / 2 - 0.01]}>
              <boxGeometry args={[0.8, 0.14, 0.02]} />
              <Surface color={CRUISE_COLORS.balconyRail} {...surface} />
            </mesh>
            {[-1, 1].map((end) => (
              <mesh key={end} position={[end * 0.4, 0.09, 0]}>
                <boxGeometry args={[0.02, 0.14, BALCONY_DEPTH]} />
                <Surface color={CRUISE_COLORS.balconyRail} {...surface} />
              </mesh>
            ))}
          </group>
        );
      })}
    </>
  );
}

interface PoolMeshProps {
  size: { x: number; z: number };
  color?: string;
  tint: PartTint;
  emphasis: PartEmphasis;
}

const POOL_HEIGHT = 0.3;

/** A low rim with a blue water surface just inside it. */
export function PoolMesh({ size, color, tint, emphasis }: PoolMeshProps) {
  const surface = { tint, emphasis };
  return (
    <group>
      <mesh
        {...AO_OCCLUDER}
        position={[0, POOL_HEIGHT / 2, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[size.x * 0.96, POOL_HEIGHT, size.z * 0.96]} />
        <Surface color={color ?? CRUISE_COLORS.poolRim} {...surface} />
      </mesh>
      <mesh position={[0, POOL_HEIGHT + 0.005, 0]}>
        <boxGeometry args={[size.x * 0.76, 0.012, size.z * 0.76]} />
        <Surface color={CRUISE_COLORS.poolWater} {...surface} />
      </mesh>
    </group>
  );
}

const SLIDE_HEIGHT = 2.4;
const SLIDE_RADIUS = 0.34;

/** Shared for the whole session, so never disposed. */
let slideTube: BufferGeometry | undefined;

/** A tube coiling 1.5 turns down the tower and fanning out at the bottom. */
function getSlideTube(): BufferGeometry {
  if (slideTube) return slideTube;
  const turns = 1.5;
  const steps = 24;
  const points = Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const angle = t * turns * 2 * Math.PI;
    const radius = SLIDE_RADIUS + t * t * 0.12;
    return new Vector3(
      Math.cos(angle) * radius,
      SLIDE_HEIGHT - 0.1 - t * (SLIDE_HEIGHT - 0.2),
      Math.sin(angle) * radius
    );
  });
  slideTube = new TubeGeometry(new CatmullRomCurve3(points), 64, 0.07, 8);
  return slideTube;
}

/** A tower with a tube coiled down it. Decorative. */
export function Waterslide({ color, tint, emphasis }: CruisePartProps) {
  const surface = { tint, emphasis };
  return (
    <group>
      <mesh {...AO_OCCLUDER} position={[0, SLIDE_HEIGHT / 2, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.1, SLIDE_HEIGHT, 10]} />
        <Surface color={CRUISE_COLORS.slideTower} {...surface} />
      </mesh>
      <mesh {...AO_OCCLUDER} position={[0, SLIDE_HEIGHT + 0.05, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.22, 0.1, 12]} />
        <Surface color={CRUISE_COLORS.slideTower} {...surface} />
      </mesh>
      <mesh geometry={getSlideTube()} castShadow>
        <Surface color={color ?? CRUISE_COLORS.slideTube} {...surface} />
      </mesh>
    </group>
  );
}

const WALL_HEIGHT = 1.8;
const HOLD_SPOTS: [number, number][] = [
  [-0.25, 0.2],
  [0.1, 0.35],
  [0.28, 0.6],
  [-0.15, 0.75],
  [0.05, 1.0],
  [-0.3, 1.15],
  [0.25, 1.3],
  [-0.05, 1.5],
  [0.2, 1.65],
];

/** A tall wall with coloured holds. Decorative. */
export function ClimbingWall({ color, tint, emphasis }: CruisePartProps) {
  const surface = { tint, emphasis };
  return (
    <group>
      <mesh {...AO_OCCLUDER} position={[0, WALL_HEIGHT / 2, 0]} castShadow>
        <boxGeometry args={[0.1, WALL_HEIGHT, 0.8]} />
        <Surface color={color ?? CRUISE_COLORS.wall} {...surface} />
      </mesh>
      {HOLD_SPOTS.map(([across, up], i) => (
        <mesh key={i} position={[0.08, up, across]}>
          <boxGeometry args={[0.08, 0.1, 0.12]} />
          <Surface
            color={CRUISE_COLORS.holds[i % CRUISE_COLORS.holds.length]}
            {...surface}
          />
        </mesh>
      ))}
    </group>
  );
}

const ENCLOSED_BOAT = {
  length: 1.1,
  width: 0.42,
  depth: 0.2,
  coverHeight: 0.2,
};

/** Shared for the whole session, so never disposed. */
let enclosedWindows: BufferGeometry | undefined;

/** A strip of windows down each side of the canopy, as one geometry. */
function getEnclosedWindows(): BufferGeometry {
  if (!enclosedWindows) {
    const strips = [-1, 1].map((side) =>
      new BoxGeometry(0.5, 0.08, 0.02).translate(0.05, 0.07, side * 0.17)
    );
    enclosedWindows = mergeGeometries(strips);
    for (const strip of strips) strip.dispose();
  }
  return enclosedWindows;
}

/** A closed orange lifeboat with a canopy and a strip of windows. */
export function EnclosedLifeboat({ color, tint, emphasis }: CruisePartProps) {
  const surface = { tint, emphasis };
  const geometry = getLifeboatGeometry(ENCLOSED_BOAT);
  return (
    <group position={[0, -0.24, 0]}>
      <mesh geometry={geometry.hull} castShadow>
        <Surface color={color ?? CRUISE_COLORS.enclosedBoat} {...surface} />
      </mesh>
      <mesh geometry={geometry.cover}>
        <Surface color={CRUISE_COLORS.enclosedCanopy} {...surface} />
      </mesh>
      <mesh geometry={getEnclosedWindows()}>
        <Surface
          color={CRUISE_COLORS.enclosedWindow}
          finish="glass"
          {...surface}
        />
      </mesh>
    </group>
  );
}

interface RaftCanisterProps extends CruisePartProps {
  /** World-Z direction away from the ship (see Fitting in PartMesh). */
  outward: 1 | -1;
}

/** A white canister lying along the rail, with two orange bands. */
export function RaftCanister({
  color,
  outward,
  tint,
  emphasis,
}: RaftCanisterProps) {
  const surface = { tint, emphasis };
  return (
    <group position={[0, 0.15, -outward * 0.18]} rotation={[0, 0, Math.PI / 2]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.13, 0.13, 0.7, 14]} />
        <Surface color={color ?? CRUISE_COLORS.raft} {...surface} />
      </mesh>
      {[-0.2, 0.2].map((along) => (
        <mesh key={along} position={[0, along, 0]}>
          <cylinderGeometry args={[0.137, 0.137, 0.06, 14]} />
          <Surface color={CRUISE_COLORS.raftBand} {...surface} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * A raked, tapering, single-colour stack with a rounded top and a band of
 * louvres. Its top sits 3.2 above its point like the classic funnel, so smoke
 * rises from the same place (see FUNNEL_TOP_OFFSET in effectAnchors.ts).
 */
export function ModernFunnel({ color, tint, emphasis }: CruisePartProps) {
  const surface = { tint, emphasis };
  return (
    <group rotation={[0, 0, FUNNEL_RAKE_RADIANS]}>
      <mesh
        {...AO_OCCLUDER}
        geometry={getModernFunnelGeometry().body}
        castShadow
      >
        <Surface color={color ?? CRUISE_COLORS.modernFunnel} {...surface} />
      </mesh>
      <mesh geometry={getModernFunnelGeometry().grille}>
        <Surface color={MODERN_GRILLE_COLOR} finish="metal" {...surface} />
      </mesh>
    </group>
  );
}

const MODERN_GRILLE_COLOR = "#2e3338";

/** Shared for the whole session, so never disposed. */
let modernFunnel: { body: BufferGeometry; grille: BufferGeometry } | undefined;

function getModernFunnelGeometry() {
  modernFunnel ??= {
    body: buildModernFunnelBody(),
    grille: buildModernFunnelGrille(),
  };
  return modernFunnel;
}

/**
 * A steerable propulsion pod under the keel: a strut up into the hull, a
 * capsule housing, and a propeller on the aft (world −X) end that spins like
 * the plain propeller's.
 */
export function Azipod({ color, tint, emphasis }: CruisePartProps) {
  const surface = { tint, emphasis };
  const isGhost = tint === "ghost-ok" || tint === "ghost-bad";
  const pod = color ?? CRUISE_COLORS.azipod;
  return (
    <group>
      <mesh position={[0.05, 0.3, 0]} castShadow>
        <boxGeometry args={[0.22, 0.6, 0.1]} />
        <Surface color={pod} {...surface} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <capsuleGeometry args={[0.15, 0.5, 6, 12]} />
        <Surface color={pod} {...surface} />
      </mesh>
      <group position={[-0.5, 0, 0]}>
        <Spinner enabled={!isGhost}>
          {[0, 1, 2, 3].map((i) => (
            <group key={i} rotation={[(i * Math.PI) / 2, 0, 0]}>
              <mesh position={[0, 0.24, 0]} castShadow>
                <boxGeometry args={[0.05, 0.4, 0.14]} />
                <Surface color={CRUISE_COLORS.azipodBlade} {...surface} />
              </mesh>
            </group>
          ))}
        </Spinner>
      </group>
    </group>
  );
}
