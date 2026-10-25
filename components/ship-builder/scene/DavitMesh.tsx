import {
  BoxGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  TubeGeometry,
  Vector3,
  type BufferGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  SIDE_DAVIT_HEIGHT,
  SIDE_DAVIT_REACH,
} from "@/lib/ship-builder/model/attach";
import { PALETTE } from "./palette";
import Surface, { type PartEmphasis, type PartTint } from "./Surface";

const TUBE_RADIUS = 0.05;
const REACH = 0.6;
const HEIGHT = 0.8;

/** Shared per direction for the whole session, so never disposed. */
const armCache = new Map<1 | -1, BufferGeometry>();
const sideArmCache = new Map<1 | -1, BufferGeometry>();

const SIDE_REACH = SIDE_DAVIT_REACH;
const SIDE_HEIGHT = SIDE_DAVIT_HEIGHT;

/**
 * A candy-cane arm with a foot plate, ending 0.6 outboard at 0.8 high with a
 * small pulley block, directly over where the boat hangs (see
 * DAVIT_HEIGHT/DAVIT_REACH in the model's attach.ts). One merged geometry.
 */
function getArm(outward: 1 | -1): BufferGeometry {
  const cached = armCache.get(outward);
  if (cached) return cached;
  const curve = new CatmullRomCurve3([
    new Vector3(0, 0, 0),
    new Vector3(0, 0.45, 0),
    new Vector3(0, 0.75, outward * 0.06),
    new Vector3(0, 0.88, outward * 0.25),
    new Vector3(0, 0.86, outward * 0.48),
    new Vector3(0, HEIGHT, outward * REACH),
  ]);
  const arm = new TubeGeometry(curve, 16, TUBE_RADIUS, 6, false);
  const foot = new CylinderGeometry(0.1, 0.12, 0.06, 10);
  foot.translate(0, 0.03, 0);
  const block = new BoxGeometry(0.1, 0.12, 0.1);
  block.translate(0, HEIGHT - 0.06, outward * REACH);
  const merged = mergeGeometries([arm, foot, block]);
  for (const part of [arm, foot, block]) part.dispose();
  armCache.set(outward, merged);
  return merged;
}

/**
 * A short arm on a wall plate. The local origin is the mount point, at
 * SIDE_DAVIT_MOUNT_Y above the deck (see the model's attach.ts): the plate sits
 * flat against the wall at z 0, the arm runs straight out 0.32 at height 0.15,
 * with a small brace beneath and a pulley block at the tip, over the boat.
 */
function getSideArm(outward: 1 | -1): BufferGeometry {
  const cached = sideArmCache.get(outward);
  if (cached) return cached;
  const plate = new BoxGeometry(0.3, 0.3, 0.08);
  plate.translate(0, 0.1, outward * 0.04);
  const arm = new BoxGeometry(0.06, 0.06, SIDE_REACH);
  arm.translate(0, SIDE_HEIGHT, outward * (SIDE_REACH / 2));
  const brace = new BoxGeometry(0.04, 0.04, 0.24);
  // Low on the wall, rising to under the outer part of the arm.
  brace.rotateX(-outward * Math.atan2(0.12, 0.2));
  brace.translate(0, SIDE_HEIGHT - 0.07, outward * 0.14);
  const block = new BoxGeometry(0.09, 0.1, 0.09);
  block.translate(0, SIDE_HEIGHT - 0.06, outward * SIDE_REACH);
  const parts = [plate, arm, brace, block];
  const merged = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  sideArmCache.set(outward, merged);
  return merged;
}

interface DavitMeshProps {
  outward: 1 | -1;
  color?: string;
  tint: PartTint;
  emphasis: PartEmphasis;
}

export default function DavitMesh({
  outward,
  color = PALETTE.davit,
  tint,
  emphasis,
}: DavitMeshProps) {
  return (
    <mesh geometry={getArm(outward)} castShadow>
      <Surface color={color} finish="metal" tint={tint} emphasis={emphasis} />
    </mesh>
  );
}

export function SideDavitMesh({
  outward,
  color = PALETTE.davit,
  tint,
  emphasis,
}: DavitMeshProps) {
  return (
    <mesh geometry={getSideArm(outward)} castShadow>
      <Surface color={color} finish="metal" tint={tint} emphasis={emphasis} />
    </mesh>
  );
}
