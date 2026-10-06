import Surface from "../Surface";
import { facingYaw } from "../facingYaw";
import type { Rotation } from "@/lib/ship-builder/model/types";
import type {
  PirateDecor,
  PirateDecorProps,
  PirateMesh,
  PirateMeshProps,
} from "./shared";
import { WOOD } from "./shared";

/** Coat colours, picked by the quarter turn the player gave the pirate. */
export const PIRATE_COATS = [
  "#7a1f1f",
  "#1f3a6b",
  "#3c5a3c",
  "#5a4a1f",
] as const;

const SKIN = "#e4b88a";
const PLANK_LENGTH = 1.4;
const PLANK_WIDTH = 0.34;
const PLANK_TIP_TILT = -0.12;

/** The coat for a rotation (0, 90, 180 or 270). */
export function pirateCoat(rotation: Rotation): string {
  const quarter = Math.round(rotation / 90);
  return PIRATE_COATS[((quarter % 4) + 4) % 4];
}

/** A board lashed at the deck edge and running out over the water. */
function PlankMesh({ painted, tint, emphasis, side }: PirateMeshProps) {
  const surface = { tint, emphasis };
  // Starboard is world +Z (see Fitting in PartMesh), so outboard is +Z there.
  const outward = side === "starboard" ? 1 : -1;
  return (
    <group position={[0, 0.12, 0]} rotation={[PLANK_TIP_TILT * outward, 0, 0]}>
      <mesh position={[0, 0, outward * (PLANK_LENGTH / 2 - 0.1)]} castShadow>
        <boxGeometry args={[PLANK_WIDTH, 0.04, PLANK_LENGTH]} />
        <Surface color={painted ?? WOOD.pale} finish="wood" {...surface} />
      </mesh>
      {[-1, 1].map((end) => (
        <mesh
          key={end}
          position={[end * (PLANK_WIDTH / 2 - 0.02), 0.1, outward * 0.1]}
          castShadow
        >
          <cylinderGeometry args={[0.018, 0.018, 0.2, 6]} />
          <Surface color={WOOD.dark} finish="wood" {...surface} />
        </mesh>
      ))}
      <mesh position={[0, 0.17, outward * 0.1]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.008, 0.008, PLANK_WIDTH - 0.04, 5]} />
        <Surface color={WOOD.rope} finish="wood" {...surface} />
      </mesh>
    </group>
  );
}

/** A pirate standing with a tricorn hat and a cutlass at the hip. */
function PirateCrewDecor({
  color,
  rotation,
  tint,
  emphasis,
}: PirateDecorProps) {
  const surface = { tint, emphasis };
  return (
    <group rotation={[0, facingYaw(rotation), 0]}>
      <mesh position={[0, 0.24, 0]} castShadow>
        <capsuleGeometry args={[0.09, 0.3, 6, 12]} />
        <Surface color={color ?? pirateCoat(rotation)} {...surface} />
      </mesh>
      <mesh position={[0, 0.54, 0]} castShadow>
        <sphereGeometry args={[0.08, 14, 12]} />
        <Surface color={SKIN} {...surface} />
      </mesh>
      <mesh position={[0, 0.6, 0]}>
        <coneGeometry args={[0.17, 0.03, 3]} />
        <Surface color={WOOD.black} {...surface} />
      </mesh>
      <mesh position={[0, 0.65, 0]}>
        <coneGeometry args={[0.09, 0.1, 3]} />
        <Surface color={WOOD.black} {...surface} />
      </mesh>
      <mesh position={[0.02, 0.3, 0.11]} rotation={[0.2, 0, 0]}>
        <boxGeometry args={[0.02, 0.4, 0.02]} />
        <Surface color={WOOD.pale} finish="metal" {...surface} />
      </mesh>
    </group>
  );
}

/** A small bright parrot on a short perch. */
function ParrotDecor({ rotation, tint, emphasis }: PirateDecorProps) {
  const surface = { tint, emphasis };
  return (
    <group rotation={[0, facingYaw(rotation), 0]}>
      <mesh position={[0, 0.1, 0]} castShadow>
        <cylinderGeometry args={[0.012, 0.012, 0.2, 6]} />
        <Surface color={WOOD.dark} finish="wood" {...surface} />
      </mesh>
      <mesh position={[0, 0.2, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.012, 0.012, 0.22, 6]} />
        <Surface color={WOOD.dark} finish="wood" {...surface} />
      </mesh>
      <mesh position={[0, 0.3, 0]} scale={[1, 1.3, 0.9]} castShadow>
        <sphereGeometry args={[0.07, 12, 10]} />
        <Surface color="#c8312b" {...surface} />
      </mesh>
      <mesh position={[0, 0.39, 0.02]}>
        <sphereGeometry args={[0.045, 10, 8]} />
        <Surface color="#c8312b" {...surface} />
      </mesh>
      <mesh position={[0.045, 0.39, 0.02]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.02, 0.05, 6]} />
        <Surface color="#f2c230" {...surface} />
      </mesh>
      <mesh position={[0, 0.3, -0.06]} rotation={[0.15, 0, 0]}>
        <boxGeometry args={[0.02, 0.12, 0.04]} />
        <Surface color="#2f7fc1" {...surface} />
      </mesh>
      <mesh position={[-0.02, 0.2, 0]} rotation={[0, 0, 0.3]}>
        <boxGeometry args={[0.04, 0.16, 0.03]} />
        <Surface color="#3f9a4a" {...surface} />
      </mesh>
    </group>
  );
}

export const CREW_MESHES = {
  plank: PlankMesh,
} satisfies Record<string, PirateMesh>;

export const CREW_DECOR = {
  "pirate-crew": PirateCrewDecor,
  parrot: ParrotDecor,
} satisfies Record<string, PirateDecor>;
