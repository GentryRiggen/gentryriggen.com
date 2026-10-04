import {
  CatmullRomCurve3,
  TubeGeometry,
  Vector3,
  type BufferGeometry,
} from "three";
import { PALETTE } from "./palette";
import Surface, { type PartEmphasis, type PartTint } from "./Surface";

const TUBE_RADIUS = 0.035;

/** Shared per direction for the whole session, so never disposed. */
const armCache = new Map<1 | -1, BufferGeometry>();

/**
 * A candy-cane arm: up from the deck, over, and ending 0.6 outboard at 0.8
 * high, directly over where the boat hangs (see DAVIT_HEIGHT/DAVIT_REACH in
 * the model's attach.ts).
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
    new Vector3(0, 0.8, outward * 0.6),
  ]);
  const arm = new TubeGeometry(curve, 16, TUBE_RADIUS, 6, false);
  armCache.set(outward, arm);
  return arm;
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
      <Surface color={color} tint={tint} emphasis={emphasis} />
    </mesh>
  );
}
