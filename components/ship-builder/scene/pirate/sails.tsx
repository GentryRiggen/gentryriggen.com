"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BufferGeometry,
  Float32BufferAttribute,
  PlaneGeometry,
  type BufferAttribute,
  type Group,
  type Mesh,
} from "three";
import { useShipAnimation } from "../ShipAnimationContext";
import { sceneTime } from "../testClock";
import Surface from "../Surface";
import { WOOD, type PirateMesh, type PirateMeshProps } from "./shared";

const isGhost = (tint: PirateMeshProps["tint"]) =>
  tint === "ghost-ok" || tint === "ghost-bad";

/** How far a square sail bellies forward at its middle. */
const BELLY = 0.28;
const WOBBLE = 0.04;

/**
 * Shapes a square sail's cloth for time `t`: a belly toward the bow and a
 * slow wobble, then refreshes the normals and bounds so the belly shades and
 * culls correctly. The grid is small (63 vertices), so every frame is cheap.
 */
export function billowSail(
  geometry: BufferGeometry,
  width: number,
  height: number,
  t: number
): void {
  const position = geometry.attributes.position as BufferAttribute;
  for (let i = 0; i < position.count; i++) {
    const across = (position.getZ(i) / (width / 2)) ** 2;
    const down = ((position.getY(i) + height / 2) / (height / 2)) ** 2;
    const belly = BELLY * (1 - across) * (1 - down);
    position.setX(
      i,
      belly + WOBBLE * Math.sin(t * 1.4 + position.getZ(i) * 2) * (1 - down)
    );
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
}

/** Flag length, and how far along it (0 at the pole, 1 at the tip) the skull sits. */
const FLAG_LENGTH = 0.9;
const SKULL_U = 0.4;
/** Each skull face floats this far off the cloth so the ripple never buries it. */
const SKULL_LIFT = 0.025;
const FLAG_RIPPLE = 0.08;

/** Sideways swing of the flag cloth at `u` along its length (0 at the pole). */
export function flagRipple(u: number, t: number): number {
  return Math.sin(t - u * 5) * FLAG_RIPPLE * u;
}

/** Slope of the ripple along the flag, per unit of `u`. */
function flagRippleSlope(u: number, t: number): number {
  return FLAG_RIPPLE * (Math.sin(t - u * 5) - 5 * u * Math.cos(t - u * 5));
}

/** Streams the flag cloth for time `t` (already scaled for speed). */
export function rippleFlag(geometry: BufferGeometry, t: number): void {
  const position = geometry.attributes.position as BufferAttribute;
  for (let i = 0; i < position.count; i++) {
    position.setZ(i, flagRipple(-position.getX(i) / FLAG_LENGTH, t));
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
}

interface SquareSailProps extends PirateMeshProps {
  width: number;
  height: number;
}

/** A yard across the ship with a sail hanging below it, bellying toward the bow. */
function SquareSail({
  width,
  height,
  painted,
  tint,
  emphasis,
}: SquareSailProps) {
  const { reducedMotion } = useShipAnimation();
  const cloth = useRef<Mesh>(null);
  const geometry = useMemo(() => {
    const plane = new PlaneGeometry(width, height, 8, 6);
    plane.rotateY(Math.PI / 2); // spans Z, billows along X
    plane.translate(0, -height / 2, 0);
    return plane;
  }, [width, height]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(({ clock }) => {
    if (isGhost(tint) || reducedMotion || !cloth.current) return;
    billowSail(
      cloth.current.geometry,
      width,
      height,
      sceneTime(clock.elapsedTime)
    );
  });

  const surface = { tint, emphasis };
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, width + 0.3, 8]} />
        <Surface color={WOOD.dark} finish="wood" {...surface} />
      </mesh>
      <mesh ref={cloth} geometry={geometry} castShadow>
        <Surface color={painted ?? WOOD.canvas} doubleSided {...surface} />
      </mesh>
    </group>
  );
}

interface TriangleSailProps extends PirateMeshProps {
  /** Corners in the ship's X-Y plane: tack, clew, head. */
  corners: [[number, number], [number, number], [number, number]];
}

/** A fore-and-aft triangular sail (jib, lateen) with a slight belly across Z. */
function TriangleSail({ corners, painted, tint, emphasis }: TriangleSailProps) {
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    const [a, b, c] = corners;
    g.setAttribute(
      "position",
      new Float32BufferAttribute(
        [a[0], a[1], 0, b[0], b[1], 0.1, c[0], c[1], 0.18],
        3
      )
    );
    g.computeVertexNormals();
    return g;
  }, [corners]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} castShadow>
      <Surface
        color={painted ?? WOOD.canvas}
        doubleSided
        tint={tint}
        emphasis={emphasis}
      />
    </mesh>
  );
}

/** A tapered mast with a cap; sails and the flag hang off its points. */
function WoodMast({
  height,
  painted,
  tint,
  emphasis,
}: PirateMeshProps & { height: number }) {
  const surface = { tint, emphasis };
  return (
    <group>
      <mesh position={[0, height / 2, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.1, height, 10]} />
        <Surface color={painted ?? WOOD.oak} finish="wood" {...surface} />
      </mesh>
      <mesh position={[0, height + 0.04, 0]} castShadow>
        <sphereGeometry args={[0.07, 10, 8]} />
        <Surface color={WOOD.dark} finish="wood" {...surface} />
      </mesh>
    </group>
  );
}

/** The Jolly Roger: a black flag streaming toward the stern, with a skull. */
function JollyRoger({ tint, emphasis }: PirateMeshProps) {
  const { reducedMotion } = useShipAnimation();
  const cloth = useRef<Mesh>(null);
  const skull = useRef<Group>(null);
  const geometry = useMemo(() => {
    const plane = new PlaneGeometry(FLAG_LENGTH, 0.55, 8, 2);
    plane.translate(-FLAG_LENGTH / 2, 0.3, 0);
    return plane;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(({ clock }) => {
    if (isGhost(tint) || reducedMotion || !cloth.current) return;
    const t = sceneTime(clock.elapsedTime) * 4;
    rippleFlag(cloth.current.geometry, t);
    // The skull rides the cloth: same height, tilted to the cloth's slope.
    if (!skull.current) return;
    skull.current.position.z = flagRipple(SKULL_U, t);
    skull.current.rotation.y = Math.atan(
      flagRippleSlope(SKULL_U, t) / FLAG_LENGTH
    );
  });
  const surface = { tint, emphasis };
  return (
    <group>
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.015, 0.02, 0.6, 6]} />
        <Surface color={WOOD.dark} finish="wood" {...surface} />
      </mesh>
      <mesh ref={cloth} geometry={geometry} castShadow>
        <Surface color={WOOD.black} doubleSided {...surface} />
      </mesh>
      <group ref={skull} position={[-FLAG_LENGTH * SKULL_U, 0.3, 0]}>
        {[1, -1].map((side) => (
          <mesh key={side} position={[0, 0, side * SKULL_LIFT]}>
            <circleGeometry args={[0.08, 12]} />
            <Surface color={WOOD.bone} doubleSided {...surface} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

const square = (width: number, height: number): PirateMesh =>
  function Sail(props) {
    return <SquareSail width={width} height={height} {...props} />;
  };

const mast = (height: number): PirateMesh =>
  function Mast(props) {
    return <WoodMast height={height} {...props} />;
  };

/**
 * The jib point is 0.75 ahead of the foremast on a beakhead bow, so the sail
 * stops just short of the mast (and the foresail's belly) instead of running
 * through them.
 */
const JIB_CORNERS: TriangleSailProps["corners"] = [
  [0.3, 0],
  [-0.4, 0.2],
  [-0.35, 3],
];
const LATEEN_CORNERS: TriangleSailProps["corners"] = [
  [0.9, 0.1],
  [-1.2, 0],
  [-0.7, 2.3],
];

export const SAIL_MESHES = {
  "mast-wood-short": mast(5),
  "mast-wood-tall": mast(7),
  "mast-wood-main": mast(9),
  "sail-square-small": square(1.1, 1.2),
  "sail-square": square(1.6, 1.6),
  "sail-square-large": square(2.1, 2.0),
  "sail-jib": function Jib(props) {
    return <TriangleSail corners={JIB_CORNERS} {...props} />;
  },
  "sail-lateen": function Lateen(props) {
    return <TriangleSail corners={LATEEN_CORNERS} {...props} />;
  },
  "flag-jolly-roger": JollyRoger,
} satisfies Record<string, PirateMesh>;
