import {
  BoxGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  TubeGeometry,
  Vector3,
  type BufferGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { PALETTE } from "./palette";
import Surface, { type PartEmphasis, type PartTint } from "./Surface";

const TUBE_RADIUS = 0.05;
const REACH = 0.6;
const HEIGHT = 0.8;

/** Shared per direction for the whole session, so never disposed. */
const armCache = new Map<1 | -1, BufferGeometry>();

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
