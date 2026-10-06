"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  PlaneGeometry,
  type BufferAttribute,
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
    const position = cloth.current.geometry.attributes
      .position as BufferAttribute;
    const t = sceneTime(clock.elapsedTime);
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
  const length = 0.9;
  const geometry = useMemo(() => {
    const plane = new PlaneGeometry(length, 0.55, 8, 2);
    plane.translate(-length / 2, 0.3, 0);
    return plane;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(({ clock }) => {
    if (isGhost(tint) || reducedMotion || !cloth.current) return;
    const position = cloth.current.geometry.attributes
      .position as BufferAttribute;
    const t = sceneTime(clock.elapsedTime) * 4;
    for (let i = 0; i < position.count; i++) {
      const u = -position.getX(i) / length;
      position.setZ(i, Math.sin(t - u * 5) * 0.08 * u);
    }
    position.needsUpdate = true;
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
      {[1, -1].map((side) => (
        <group key={side} position={[-length * 0.4, 0.3, side * 0.012]}>
          <mesh>
            <circleGeometry args={[0.08, 12]} />
            <meshBasicMaterial color={WOOD.bone} side={DoubleSide} />
          </mesh>
        </group>
      ))}
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

const JIB_CORNERS: TriangleSailProps["corners"] = [
  [0.25, 0],
  [-2.0, 0.1],
  [-1.9, 3.2],
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
